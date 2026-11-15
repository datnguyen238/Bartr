"""Grounded comparable search with server-calculated, revision-bound estimates."""
from starlette.concurrency import run_in_threadpool

from ..errors import AppError
from .valuation import GeminiValuationProvider, ValuationProviderError, calculate, now
from .image_analysis import GeminiImageAnalysis


class MarketAnalysis:
    async def fallback(self, facts, image):
        result = await GeminiImageAnalysis().analyze(facts, image)
        result['fallback_reason'] = 'comparables_unavailable'
        return result

    async def analyze(self, facts, image):
        provider = GeminiValuationProvider()
        if not provider.configured:
            raise AppError('Configure Gemini to search for comparable items.', 'GEMINI_NOT_CONFIGURED', 503)
        if not image:
            raise AppError('Upload an item photo before evaluation.', 'IMAGE_REQUIRED', 422)
        try:
            batch = await run_in_threadpool(provider.valuate, facts, image)
            result = calculate(batch['extraction'], batch['sources'], now().isoformat())
        except (ValuationProviderError, TimeoutError):
            return await self.fallback(facts, image)
        except Exception as exc:
            import logging
            logging.getLogger('uvicorn.error').warning('Comparable search failed provider=gemini type=%s status=%s', type(exc).__name__, getattr(exc, 'status_code', None))
            return await self.fallback(facts, image)

        attributes = batch['attributes']
        needs_clarification = attributes.get('clarification_needed') or bool(attributes.get('clarification_questions'))
        if result['status'] == 'insufficient_evidence' or needs_clarification:
            return await self.fallback(facts, image)
        eligible = [entry for entry in result['evidence'] if entry['source_id'] in result['evidence_ids']]
        evidence = eligible if result['status'] == 'estimated' else result['evidence']
        prices = sorted(entry['price_minor'] for entry in eligible)
        middle = len(prices) // 2
        estimate = (prices[middle] if len(prices) % 2 else (prices[middle - 1] + prices[middle]) // 2) if prices and not needs_clarification else None
        return {
            'status': 'clarification_required' if needs_clarification else result['status'],
            'attributes': attributes,
            'estimate_minor': estimate,
            'currency': 'USD',
            'uncertainty': result['confidence'] or 'high',
            'uncertainty_reasons': result['caveats'],
            'price_basis': 'market_comparables',
            'comparison_basis': result['price_basis'],
            'range': result['range'] if estimate is not None else None,
            'evidence': evidence,
            'attribution': batch.get('attribution', {}),
            'model': provider.model,
            'prompt_version': provider.fingerprint,
            'schema_version': 'analysis.market.v1',
        }

import asyncio

import pytest

from backend.app.errors import AppError
from backend.app.services.image_analysis import GeminiImageAnalysis
from backend.app.services.market_analysis import MarketAnalysis
from backend.app.services.valuation import GeminiValuationProvider, ValuationProviderError


@pytest.mark.parametrize('failure', [ValuationProviderError('search', 429), TimeoutError()])
def test_search_failure_uses_unlicensed_image_estimate(monkeypatch, failure):
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture')
    monkeypatch.setenv('GEMINI_MODEL', 'fixture')
    def search(*args):
        raise failure
    async def estimate(self, facts, image):
        return {'status': 'estimated', 'price_basis': 'image_assisted_estimate', 'estimate_minor': 1500, 'evidence': []}
    monkeypatch.setattr(GeminiValuationProvider, 'valuate', search)
    monkeypatch.setattr(GeminiImageAnalysis, 'analyze', estimate)
    result = asyncio.run(MarketAnalysis().analyze({}, {'data': b'photo'}))
    assert result['estimate_minor'] == 1500
    assert result['price_basis'] == 'image_assisted_estimate'
    assert result['fallback_reason'] == 'comparables_unavailable'
    assert result['evidence'] == []


def test_insufficient_comparables_uses_image_estimate(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture')
    monkeypatch.setenv('GEMINI_MODEL', 'fixture')
    monkeypatch.setattr(GeminiValuationProvider, 'valuate', lambda *args: {'extraction': object(), 'sources': {}, 'attributes': {}})
    monkeypatch.setattr('backend.app.services.market_analysis.calculate', lambda *args: {'status': 'insufficient_evidence'})
    async def estimate(self, facts, image):
        return {'status': 'estimated', 'price_basis': 'image_assisted_estimate', 'estimate_minor': 1500, 'evidence': []}
    monkeypatch.setattr(GeminiImageAnalysis, 'analyze', estimate)
    assert asyncio.run(MarketAnalysis().analyze({}, {'data': b'photo'}))['fallback_reason'] == 'comparables_unavailable'


def test_fallback_failure_does_not_fabricate_estimate(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture')
    monkeypatch.setenv('GEMINI_MODEL', 'fixture')
    def search(*args):
        raise TimeoutError()
    async def estimate(self, facts, image):
        raise AppError('Unavailable', 'ANALYSIS_UNAVAILABLE', 503)
    monkeypatch.setattr(GeminiValuationProvider, 'valuate', search)
    monkeypatch.setattr(GeminiImageAnalysis, 'analyze', estimate)
    with pytest.raises(AppError) as exc:
        asyncio.run(MarketAnalysis().analyze({}, {'data': b'photo'}))
    assert exc.value.code == 'ANALYSIS_UNAVAILABLE'


def test_unidentifiable_item_remains_without_estimate(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture')
    monkeypatch.setenv('GEMINI_MODEL', 'fixture')
    def search(*args):
        raise TimeoutError()
    async def estimate(self, facts, image):
        return {'status': 'clarification_required', 'price_basis': 'image_assisted_estimate', 'estimate_minor': None, 'evidence': [], 'attributes': {'clarification_questions': ['What is this item?']}}
    monkeypatch.setattr(GeminiValuationProvider, 'valuate', search)
    monkeypatch.setattr(GeminiImageAnalysis, 'analyze', estimate)
    result = asyncio.run(MarketAnalysis().analyze({}, {'data': b'photo'}))
    assert result['estimate_minor'] is None and result['status'] == 'clarification_required'

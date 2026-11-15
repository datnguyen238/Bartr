from copy import deepcopy
import json
import pytest
from backend.app.services.valuation import (Attributes, Comparable, Extraction, GeminiValuationProvider, calculate, now, supported_price)

def evidence_fixture():
    comparables, sources = [], {}
    for index, price in enumerate([2000, 3000, 4000]):
        source_id = f's{index}'
        comparables.append(Comparable(source_id=source_id, price_minor=price, currency='USD',
            price_type='asking', condition='used', comparable_match=True, condition_match=True, identity=f'offer-{index}'))
        sources[source_id] = {'uri': f'https://example.com/item/{index}', 'title': f'Used lamp {index}',
                              'supported_text': f'Used lamp without bulb. Asking USD {price / 100:.2f}.'}
    return {'attributes': Attributes(description='Used lamp without bulb', brand=None, model=None,
                                     clarification_needed=False, clarification_questions=[]).model_dump(),
            'sources': sources, 'extraction': Extraction(comparables=comparables), 'attribution': {}}

@pytest.mark.parametrize('mutation', ['invented_source', 'unsupported_price', 'duplicate', 'condition', 'mixed_basis'])
def test_unsupported_or_incompatible_evidence_cannot_form_range(mutation):
    fixture = evidence_fixture()
    items = fixture['extraction'].comparables
    if mutation == 'invented_source':
        items[0].source_id = 'invented'
    elif mutation == 'unsupported_price':
        items[0].price_minor = 9999
    elif mutation == 'duplicate':
        items[0].identity = items[1].identity
    elif mutation == 'condition':
        items[0].condition_match = False
    else:
        items[0].price_type = 'sold'
    value = calculate(fixture['extraction'], fixture['sources'], now().isoformat())
    assert value['status'] == 'insufficient_evidence' and value['range'] is None

def test_usd_amount_check_handles_decimal_and_thousands():
    assert supported_price('USD 1,200.50', 120050)
    assert supported_price('$29.99', 2999)
    assert not supported_price('USD 29.99', 2900)
    assert not supported_price('No price available', 1000)

def test_sold_evidence_gets_its_own_basis_and_range():
    fixture = evidence_fixture()
    for item in fixture['extraction'].comparables:
        item.price_type = 'sold'
    value = calculate(fixture['extraction'], fixture['sources'], now().isoformat())
    assert value['price_basis'] == 'sold' and value['confidence'] == 'medium'
    assert value['range']['high_minor'] == 4000

def test_real_adapter_uses_grounding_metadata_and_separate_extraction(monkeypatch):
    genai = pytest.importorskip("google.genai")
    fixture = evidence_fixture()
    sources = fixture['sources']
    from google.genai import interactions
    def response(text):
        return interactions.Interaction(status='completed', steps=[{'type': 'model_output', 'content': [{'type': 'text', 'text': text}]}])
    steps = [
        {'type': 'google_search_call', 'id': 'search-1', 'arguments': {'queries': ['used lamp']}},
        {'type': 'google_search_result', 'call_id': 'search-1', 'result': [{'search_suggestions': '<div>Attribution</div>'}]},
    ]
    for source in sources.values():
        text = source['supported_text']
        steps.append({'type': 'model_output', 'content': [{'type': 'text', 'text': text,
            'annotations': [{'type': 'url_citation', 'start_index': 0, 'end_index': len(text),
                             'url': source['uri'], 'title': source['title']}]}]})
    grounded = interactions.Interaction(status='completed', steps=steps)
    responses = iter([grounded, response(json.dumps({
        'attributes': fixture['attributes'], 'comparables': fixture['extraction'].model_dump()['comparables']}))])
    calls = []
    class Interactions:
        def create(self, **kwargs):
            calls.append(kwargs)
            return next(responses)
    class Client:
        interactions = Interactions()
        def __init__(self, **kwargs):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *args):
            pass
    monkeypatch.setattr(genai, 'Client', Client)
    monkeypatch.setenv('GEMINI_API_KEY', 'test-key')
    monkeypatch.setenv('GEMINI_VALUATION_MODEL', 'test-model')
    result = GeminiValuationProvider().valuate({'title': 'Lamp', 'condition': 'Bulb missing'}, image={'data': b'normalized-photo', 'mime_type': 'image/jpeg'})
    assert len(calls) == 2 and calls[0]['tools'] == [{'type': 'google_search'}]
    assert calls[0]['input'][1] == {'type': 'image', 'data': 'bm9ybWFsaXplZC1waG90bw==', 'mime_type': 'image/jpeg'}
    assert 'data' not in calls[1]['input']
    assert all(call['store'] is False and 0 < call['timeout'] <= 35 for call in calls)
    assert calls[1]['timeout'] <= calls[0]['timeout']
    assert all(call['automatic_continuation'] is False for call in calls)
    assert calls[1]['response_format']['schema']['additionalProperties'] is False
    assert calls[1]['response_format']['schema']['$defs']['Comparable']['additionalProperties'] is False
    assert result['sources']['s0']['supported_text'].startswith('Used lamp')
    assert result['attribution']['search_entry_point_html']
    assert calculate(result['extraction'], result['sources'], now().isoformat())['status'] == 'estimated'

def test_interaction_citations_exclude_uncited_text_and_invalid_offsets():
    interactions = pytest.importorskip('google.genai.interactions')
    from backend.app.services.valuation import grounded_sources
    text = 'Uncited USD 999. Used lamp asking USD 30.'
    start = text.index('Used lamp')
    interaction = interactions.Interaction(status='completed', steps=[{
        'type': 'model_output', 'content': [{'type': 'text', 'text': text, 'annotations': [
            {'type': 'url_citation', 'url': 'https://example.com/lamp', 'start_index': start, 'end_index': len(text)},
            {'type': 'url_citation', 'url': 'https://example.com/invalid', 'start_index': -1, 'end_index': 999},
        ]}],
    }])
    sources, _ = grounded_sources(interaction)
    assert len(sources) == 1
    assert '999' not in sources['s0']['supported_text']
    assert supported_price(sources['s0']['supported_text'], 3000)

def test_incomplete_interaction_cannot_be_valued():
    interactions = pytest.importorskip('google.genai.interactions')
    from backend.app.services.valuation import completed_text
    with pytest.raises(ValueError):
        completed_text(interactions.Interaction(status='incomplete'))

def test_google_quota_failure_returns_immediately_without_retry():
    from types import SimpleNamespace
    from backend.app.services import valuation
    attempts = []
    class Limited(Exception):
        status_code = 429
        response = SimpleNamespace(headers={'retry-after': '30'})
    class Interactions:
        def create(self, **kwargs):
            attempts.append(kwargs)
            raise Limited('private payload')
    client = SimpleNamespace(interactions=Interactions())
    with pytest.raises(valuation.ValuationProviderError) as caught:
        valuation.request_interaction(client, 'search', valuation.monotonic() + 35,
                                      model='test', tools=[{'type':'google_search'}])
    assert len(attempts) == 1
    assert caught.value.status_code == 429
    assert caught.value.stage == 'search' and caught.value.retry_after == 30
    assert 'private' not in str(caught.value)

def test_expired_deadline_prevents_another_model_request():
    from types import SimpleNamespace
    from backend.app.services import valuation
    class Interactions:
        def create(self, **kwargs):
            pytest.fail('Deadline already exhausted')
    with pytest.raises(TimeoutError):
        valuation.request_interaction(SimpleNamespace(interactions=Interactions()), 'extraction', valuation.monotonic() - 1)

def test_market_timeout_can_be_configured(monkeypatch):
    monkeypatch.setenv('GEMINI_MARKET_TIMEOUT_SECONDS','60')
    assert GeminiValuationProvider().timeout_seconds==60
    monkeypatch.setenv('GEMINI_MARKET_TIMEOUT_SECONDS','0')
    with pytest.raises(ValueError):
        GeminiValuationProvider()


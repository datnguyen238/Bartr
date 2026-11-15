"""Schema boundary coverage, authored for the owner to run."""
import pytest
from pydantic import ValidationError

from backend.app.services.image_analysis import GeminiImageAnalysis, ImageAssessment, assessment_result, provider_schema


def candidate(value):
    return {'title':'Chair','category':'Furniture','description':'A wooden chair',
            'brand':None,'model':None,'estimate_cents':value,'uncertainty':'high',
            'uncertainty_reasons':['Condition cannot be verified from a photo.'],
            'clarification_questions':[]}


@pytest.mark.parametrize('value',[0,-1,1.5,'4000',True,1_000_000_000_001])
def test_estimate_rejects_invalid_or_non_integer_amounts(value):
    with pytest.raises(ValidationError):
        ImageAssessment.model_validate(candidate(value))


def test_unknown_and_positive_estimates_remain_distinct():
    assert ImageAssessment.model_validate(candidate(None)).estimate_cents is None
    assert ImageAssessment.model_validate(candidate(4000)).estimate_cents==4000


def test_optional_questions_do_not_discard_estimate():
    data = candidate(4000)
    data['clarification_questions'] = ['What is the exact wattage?']
    result = assessment_result(ImageAssessment.model_validate(data), 'fixture')
    assert result['status'] == 'estimated' and result['estimate_minor'] == 4000
    assert result['attributes']['clarification_questions'] == []
    assert result['price_basis'] == 'image_assisted_estimate' and result['evidence'] == []


def test_material_conflict_prevents_estimate():
    data = candidate(4000)
    data['material_conflict'] = True
    data['clarification_questions'] = ['Which item is shown?']
    result = assessment_result(ImageAssessment.model_validate(data), 'fixture')
    assert result['status'] == 'clarification_required' and result['estimate_minor'] is None


def test_missing_estimate_retries_once_with_known_item(monkeypatch):
    import asyncio
    import json
    from types import SimpleNamespace
    from google import genai
    responses = [candidate(None), candidate(1500)]
    calls = []
    class FakeClient:
        def __init__(self, **kwargs):
            self.aio = self
            self.models = self
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def generate_content(self, **kwargs):
            calls.append(kwargs)
            return SimpleNamespace(text=json.dumps(responses.pop(0)))
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture')
    monkeypatch.setenv('GEMINI_MODEL', 'fixture')
    monkeypatch.setattr(genai, 'Client', FakeClient)
    result = asyncio.run(GeminiImageAnalysis().analyze({'title': 'Power adapter', 'description': 'Apple power adapter', 'condition': 'Used'}, {'data': b'photo', 'mime_type': 'image/jpeg'}))
    assert len(calls) == 2 and result['estimate_minor'] == 1500
    assert result['price_basis'] == 'image_assisted_estimate' and result['range'] is None
    assert 'short description' in calls[0]['config'].system_instruction
    assert 'short description' in calls[1]['config'].system_instruction


def test_missing_estimate_retry_failure_preserves_unknown_result(monkeypatch):
    import asyncio
    import json
    from types import SimpleNamespace
    from google import genai
    calls = []
    class FakeClient:
        def __init__(self, **kwargs):
            self.aio = self
            self.models = self
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def generate_content(self, **kwargs):
            calls.append(1)
            if len(calls) == 2:
                raise TimeoutError()
            return SimpleNamespace(text=json.dumps(candidate(None)))
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture')
    monkeypatch.setenv('GEMINI_MODEL', 'fixture')
    monkeypatch.setattr(genai, 'Client', FakeClient)
    result = asyncio.run(GeminiImageAnalysis().analyze({'title': 'Power adapter'}, {'data': b'photo', 'mime_type': 'image/jpeg'}))
    assert len(calls) == 2 and result['estimate_minor'] is None and result['status'] == 'unknown'


def test_provider_schema_uses_sdk_json_schema_without_weakening_local_validation():
    from google.genai import types
    schema = provider_schema()
    config = types.GenerateContentConfig(response_mime_type='application/json', response_json_schema=schema)
    assert config.response_schema is None
    assert config.response_json_schema['properties']['estimate_cents']
    assert 'exclusiveMinimum' not in str(schema)
    with pytest.raises(ValidationError):
        ImageAssessment.model_validate(candidate(0))


def test_image_model_override_does_not_change_general_model(monkeypatch):
    monkeypatch.setenv('GEMINI_API_KEY', 'fixture-key')
    monkeypatch.setenv('GEMINI_MODEL', 'general-model')
    monkeypatch.setenv('GEMINI_IMAGE_MODEL', 'image-model')
    assert GeminiImageAnalysis().model == 'image-model'
    monkeypatch.delenv('GEMINI_IMAGE_MODEL')
    monkeypatch.delenv('GEMINI_VALUATION_MODEL', raising=False)
    assert GeminiImageAnalysis().model == 'general-model'

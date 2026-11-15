"""Schema boundary coverage, authored for the owner to run."""
import pytest
from pydantic import ValidationError

from backend.app.services.image_analysis import GeminiImageAnalysis, ImageAssessment, provider_schema


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

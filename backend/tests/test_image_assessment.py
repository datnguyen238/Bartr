"""Schema boundary coverage, authored for the owner to run."""
import pytest
from pydantic import ValidationError

from backend.app.services.image_analysis import ImageAssessment


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

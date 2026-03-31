from django import forms
from .models import UserPreference



class PreferenceForm(forms.ModelForm):
    class Meta:
        model = UserPreference
        exclude = ['id', 'user'] # Exclude used






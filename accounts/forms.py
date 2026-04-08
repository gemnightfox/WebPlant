from django import forms
from .models import UserPreference, CustomUser



class PreferenceForm(forms.ModelForm):
    class Meta:
        model = UserPreference
        exclude = ['id', 'user'] # Exclude used



class EditUsernameForm(forms.ModelForm):
    class Meta:
        model = CustomUser
        fields = ['username']




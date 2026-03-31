from django import forms
from .models import Group



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Group
        fields = ['name', 'position']
    
    def __init__(self, *args, project, **kwargs):
        super().__init__(*args, **kwargs)
        self.project = project
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.project = self.project
        if commit:
            instance.save()
        return instance



class EditForm(forms.ModelForm):
    class Meta:
        model = Group
        exclude = ['id', 'created_at'] # Note: Exclude used









from django import forms
from .models import Project



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name']

    def __init__(self, *args, workspace, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace = workspace
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.workspace = self.workspace

        if commit:
            instance.save()
        return instance



class EditNameForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name']




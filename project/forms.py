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
        if commit:
            instance = super().save(commit=False)
            instance.workspace = self.workspace
            instance.save()



class EditNameForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name']




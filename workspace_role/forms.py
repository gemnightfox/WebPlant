from django import forms
from .models import WorkspaceRole



class CreateForm(forms.ModelForm):
    class Meta:
        model = WorkspaceRole
        exclude = ['id', 'workspace'] # Note: EXCLUDE used

    def __init__(self, *args, workspace, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace = workspace

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.workspace = self.workspace

        if commit:
            instance.save()
        return instance



class EditForm(forms.ModelForm):
    class Meta:
        model = WorkspaceRole
        exclude = ['id', 'workspace'] # Note: EXCLUDE used




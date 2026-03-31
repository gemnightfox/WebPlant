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
        if commit:
            instance = super().save(commit=False)
            instance.workspace = self.workspace
            instance.save()



class EditForm(forms.ModelForm):
    class Meta:
        model = WorkspaceRole
        exclude = ['id', 'workspace'] # Note: EXCLUDE used




from django import forms
from .models import Project



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name']

    def __init__(self, *args, workspace, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace = workspace
        self.my_workspace_user = my_workspace_user
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.workspace = self.workspace

        if commit:
            instance.save(workspace_user=self.my_workspace_user)
        return instance



class EditNameForm(forms.ModelForm):
    class Meta:
        model = Project
        fields = ['name']

    def __init__(self, *args, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.my_workspace_user = my_workspace_user

    def save(self, commit=True):
        instance = super().save(commit=False)
        if commit:
            instance.save(workspace_user=self.my_workspace_user)
        return instance




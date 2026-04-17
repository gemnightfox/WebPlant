from django import forms
from .models import Group



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Group
        fields = ['name', 'position']
    
    def __init__(self, *args, project, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.project = project
        self.my_workspace_user = my_workspace_user
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.project = self.project

        if commit:
            instance.save(workspace_user=self.my_workspace_user)
        return instance



class EditForm(forms.ModelForm):
    class Meta:
        model = Group
        exclude = ['id', 'created_at'] # Note: Exclude used

    def __init__(self, *args, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.my_workspace_user = my_workspace_user
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        if commit:
            instance.save(workspace_user=self.my_workspace_user)
        return instance






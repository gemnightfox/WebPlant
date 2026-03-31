from django import forms
from .models import Task, TaskComment, TaskReminder



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ['name', 'position']
    
    def __init__(self, *args, group, **kwargs):
        super().__init__(*args, **kwargs)
        self.group = group
    
    def save(self, commit=True):
        if commit:
            instance = super().save(commit=False)
            instance.group = self.group
            instance.save()



class EditForm(forms.ModelForm):
    class Meta:
        model = Task
        exclude = ['id', 'created_at'] # Note: Exclude used



class AddCommentForm(forms.ModelForm):
    class Meta:
        model = TaskComment
        fields = ['content']
    
    def __init__(self, *args, task, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.task = task
        self.my_workspace_user = my_workspace_user
    
    def save(self, commit=True):
        if commit:
            instance = super().save(commit=False)
            instance.task = self.task
            instance.added_by = self.my_workspace_user
            instance.save()



class EditCommentForm(forms.ModelForm):
    class Meta:
        model = TaskComment
        fields = ['content']



class AddReminderForm(forms.ModelForm):
    class Meta:
        model = TaskReminder
        fields = ['send_at']
    
    def __init__(self, *args, task, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.task = task
        self.my_workspace_user = my_workspace_user

    def save(self, commit=True):
        if commit:
            instance = super().save(commit=False)
            instance.task = self.task
            instance.workspace_user = self.my_workspace_user
            instance.save()




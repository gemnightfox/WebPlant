from django import forms
from .models import Task, TaskComment, TaskReminder
from workspace_role.utils import verify_workspace_role



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ['name', 'position']
    
    def __init__(self, *args, group, **kwargs):
        super().__init__(*args, **kwargs)
        self.group = group
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.group = self.group

        if commit:
            instance.save()
        return instance



class EditForm(forms.ModelForm):
    class Meta:
        model = Task
        exclude = ['id', 'created_at'] # Note: Exclude used

    def __init__(self, *args, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.my_workspace_user = my_workspace_user
    
    def clean(self):
        cleaned_data = super().clean()
        old_deadline = self.instance.deadline
        new_deadline = cleaned_data['deadline']
        if old_deadline != new_deadline:
            verify_workspace_role(self.my_workspace_user, 'can_edit_task_deadline')
        return cleaned_data



class AddCommentForm(forms.ModelForm):
    class Meta:
        model = TaskComment
        fields = ['content']
    
    def __init__(self, *args, task, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.task = task
        self.my_workspace_user = my_workspace_user
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.task = self.task
        instance.added_by = self.my_workspace_user

        if commit:
            instance.save()
        return instance



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
        instance = super().save(commit=False)
        instance.task = self.task
        instance.workspace_user = self.my_workspace_user

        if commit:
            instance.save()
        return instance





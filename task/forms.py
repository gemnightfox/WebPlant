from django import forms
from .models import Task, TaskAttachment, TaskComment, TaskReminder, TaskAssigned
from workspace.utils import verify_workspace_role
from notification.utils import can_receive_notifications, send_email



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Task
        fields = ['name', 'position']
    
    def __init__(self, *args, group, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.group = group
        self.my_workspace_user = my_workspace_user
    
    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.group = self.group

        if commit:
            instance.save(workspace_user=self.my_workspace_user)
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

    def save(self, commit=True):
        instance = super().save(commit=False)
        if commit:
            instance.save(workspace_user=self.my_workspace_user)
        return instance



class AddAttachmentForm(forms.ModelForm):
    class Meta:
        model = TaskAttachment
        fields = ['file']
    
    def __init__(self, *args, task, **kwargs):
        super().__init__(*args, **kwargs)
        self.task = task

    def clean(self):
        cleaned_data = super().clean()
        file = cleaned_data['file']
        MAXIMUM_FILE_SIZE = 1024 * 1024 * 100 # 100MB
        if file.size > MAXIMUM_FILE_SIZE:
            raise forms.ValidationError('File size can not be greater than 100MB.')
        return cleaned_data

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.task = self.task

        if commit:
            instance.save()
        return instance



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



class AddAssignedForm(forms.ModelForm):
    class Meta:
        model = TaskAssigned
        fields = ['assigned_to']

    def __init__(self, *args, form_request, task, **kwargs):
        super().__init__(*args, **kwargs)
        self.form_request = form_request
        self.task = task
        self.fields['assigned_to'].queryset = TaskAssigned.objects.filter(assigned_to__workspace=task.group.project.workspace)

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.task = self.task

        if commit:
            instance.save()
            user = instance.assigned_to.user
            request = self.form_request
            workspace = self.task.group.project.workspace

            if can_receive_notifications(user):
                send_email(request, receiver=user, sender=request.user, content=f'You have been assigned to task ({workspace.name}): {self.task.name}')

        return instance







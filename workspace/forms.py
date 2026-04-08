from django import forms
from workspace_role.models import WorkspaceRole
from .models import WorkspaceInviteCode, WorkspacePreference, WorkspaceUser, Workspace
from django.db import transaction
from .utils import generate_workspace_invite_code
from notification.utils import send_email
from accounts.utils import get_user_preferences
from django.contrib.auth import get_user_model



class CreateNewForm(forms.ModelForm):
    class Meta:
        model = Workspace
        fields = ['name']

    def __init__(self, *args, current_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.current_user = current_user

    def save(self, commit=True):
        if commit:
            with transaction.atomic():
                workspace_instance = super().save() # owner=None, default_role=None

                # Default roles provided (Users dont have to create their own roles, unless they want custom functionality)
                admin_role = WorkspaceRole.objects.create(
                    workspace=workspace_instance,
                    name='Admin',
                    can_edit_workspace_name=True,
                    can_edit_workspace_preference=True,
                    can_edit_workspace_invite_codes=True,
                    can_add_workspace_users=True,
                    can_assign_roles_to_workspace_users=True,
                    can_remove_workspace_users=True,
                    can_edit_workspace_roles=True,
                    can_edit_projects=True,
                    can_edit_groups=True,
                    can_edit_tasks=True,
                    can_add_task_comments=True,
                    can_edit_task_deadline=True,
                )

                editor_role = WorkspaceRole.objects.create(
                    workspace=workspace_instance,
                    name='Editor',
                    can_edit_workspace_name=False,
                    can_edit_workspace_preference=True,
                    can_edit_workspace_invite_codes=False,
                    can_add_workspace_users=False,
                    can_assign_roles_to_workspace_users=False,
                    can_remove_workspace_users=False,
                    can_edit_workspace_roles=False,
                    can_edit_projects=True,
                    can_edit_groups=True,
                    can_edit_tasks=True,
                    can_add_task_comments=True,
                    can_edit_task_deadline=True,
                )

                WorkspaceRole.objects.create(
                    workspace=workspace_instance,
                    name='Viewer',
                    can_edit_workspace_name=False,
                    can_edit_workspace_preference=False,
                    can_edit_workspace_invite_codes=False,
                    can_add_workspace_users=False,
                    can_assign_roles_to_workspace_users=False,
                    can_remove_workspace_users=False,
                    can_edit_workspace_roles=False,
                    can_edit_projects=False,
                    can_edit_groups=False,
                    can_edit_tasks=False,
                    can_add_task_comments=False,
                    can_edit_task_deadline=False,
                )

                # Creates a WorkspaceUser object for request.user (current user)
                owner_workspace_user = WorkspaceUser.objects.create(
                    workspace=workspace_instance,
                    user=self.current_user,
                    role=admin_role, # Note: Since request.user is the workspace owner, they already have the highest perms (higher than admin)
                    is_active=True,
                )
                workspace_instance.owner = owner_workspace_user
                workspace_instance.default_role = editor_role
                workspace_instance.save()
                return workspace_instance



class TransferOwnershipForm(forms.ModelForm):
    class Meta:
        model = Workspace
        fields = ['owner']

    def __init__(self, *args, my_workspace_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['owner'].queryset = WorkspaceUser.objects.filter(workspace=self.instance, is_active=True).exclude(id=my_workspace_user.id)



class SetPreferenceForm(forms.ModelForm):
    class Meta:
        model = WorkspacePreference
        exclude = ['id','workspace'] # Note: EXCLUDE used



class ChangeDefaultRoleForm(forms.ModelForm):
    class Meta:
        model = Workspace
        fields = ['default_role']
    
    def clean(self):
        cleaned_data = super().clean()
        if not cleaned_data['default_role']:
            raise forms.ValidationError('Default role can not be NULL/None')
        return cleaned_data



class EditNameForm(forms.ModelForm):
    class Meta:
        model = Workspace
        fields = ['name']



class AddUsersForm(forms.ModelForm):
    username = forms.CharField(max_length=150)

    class Meta:
        model = WorkspaceUser
        fields = ['role']

    def __init__(self, *args, workspace, my_user, can_assign_roles_to_workspace_users, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace = workspace
        self.my_user = my_user
        self.can_assign_roles_to_workspace_users = can_assign_roles_to_workspace_users

    def clean(self):
        cleaned_data = super().clean()
        username = cleaned_data.get('username').lower()
        user = get_user_model().objects.filter(username=username).first() # Don't raise 404-obj-not-found, ensures that users cant check whether a username has been registered to an account (Read VALIDATION_ERROR_MESSAGE for more info)

        VALIDATION_ERROR_MESSAGE = 'Given username is not registered to an account, or does not accept workspace invites.' # Ensures that users cant check whether a username has been registered to an account
        if not user:
            raise forms.ValidationError(VALIDATION_ERROR_MESSAGE)

        user_preferences = get_user_preferences(user)
        if not user_preferences.allows_workspace_invites:
            raise forms.ValidationError(VALIDATION_ERROR_MESSAGE)

        is_user_already_in_workspace = WorkspaceUser.objects.filter(workspace=self.workspace, user=user).exists()
        if is_user_already_in_workspace:
            raise forms.ValidationError('User has already been invited to the workspace.')

        self.user = user
        return cleaned_data

    def save(self, commit=True):
        if commit:
            with transaction.atomic():
                if self.can_assign_roles_to_workspace_users:
                    role = self.cleaned_data['role']
                else:
                    role = self.workspace.default_role

                new_object = WorkspaceUser.objects.create(
                    workspace=self.workspace,
                    user=self.user, # Defined in clean()
                    role=role,
                )
                send_email(receiver=self.user, sender=self.my_user, content=f'You have been invited to workspace: {self.workspace.name}')
                return new_object



class AssignRoleToUserForm(forms.ModelForm):
    class Meta:
        model = WorkspaceUser
        fields = ['role']



class AddInviteCodeForm(forms.ModelForm):
    class Meta:
        model = WorkspaceInviteCode
        fields = ['password']

    def __init__(self, *args, workspace, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace = workspace

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.workspace = self.workspace
        
        for _ in range(5): # In practice, its very rare that it runs a second time, let alone 5 times
            invite_code = generate_workspace_invite_code()
            if not WorkspaceInviteCode.objects.filter(invite_code=invite_code).exists():
                instance.invite_code = invite_code
                break

        if commit:
            instance.save()
        return instance



class EditInviteCodePasswordForm(forms.ModelForm):
    class Meta:
        model = WorkspaceInviteCode
        fields = ['password']





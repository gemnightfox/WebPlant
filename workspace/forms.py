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
                    can_add_users=True,
                    can_assign_roles_to_users=True,
                    can_remove_users=True,
                    can_edit_roles=True,
                    can_edit_invite_codes=True,
                    can_edit_projects=True,
                    can_edit_groups=True,
                    can_edit_tasks=True,
                )

                editor_role = WorkspaceRole.objects.create(
                    workspace=workspace_instance,
                    name='Editor',
                    can_edit_workspace_name=False,
                    can_edit_workspace_preference=True,
                    can_add_users=False,
                    can_assign_roles_to_users=False,
                    can_remove_users=False,
                    can_edit_roles=False,
                    can_edit_invite_codes=False,
                    can_edit_projects=True,
                    can_edit_groups=True,
                    can_edit_tasks=True,
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
    email = forms.EmailField(max_length=254)

    class Meta:
        model = WorkspaceUser
        fields = ['role']

    def __init__(self, *args, workspace, my_user, can_assign_roles_to_users, **kwargs):
        super().__init__(*args, **kwargs)
        self.workspace = workspace
        self.my_user = my_user
        self.can_assign_roles_to_users = can_assign_roles_to_users

    def clean(self):
        cleaned_data = super().clean()
        email = cleaned_data.get('email')
        user = get_user_model().objects.filter(email__iexact=email).first() # Raise validation error instead of get_obj_or_404 (hides whether email is registered or not, read comments below for more info)

        VALIDATION_ERROR_MESSAGE = 'Given email is not registered to an account, or does not accept workspace invites.' # Ensures that users cant check whether an email has been registered to an account
        if not user:
            raise forms.ValidationError(VALIDATION_ERROR_MESSAGE)

        user_preferences = get_user_preferences(user)
        if not user_preferences.workspace_invites:
            raise forms.ValidationError(VALIDATION_ERROR_MESSAGE)

        is_user_already_in_workspace = WorkspaceUser.objects.filter(workspace=self.workspace, user=user).exists()
        if is_user_already_in_workspace:
            raise forms.ValidationError('User has already been invited to the workspace.')

        self.user = user
        return cleaned_data

    def save(self, commit=True):
        if commit:
            with transaction.atomic():
                if self.can_assign_roles_to_users:
                    role = self.cleaned_data['role']
                else:
                    role = self.workspace.default_role

                WorkspaceUser.objects.create(
                    workspace=self.workspace,
                    user=self.user, # Defined in clean()
                    role=role,
                )
                send_email(receiver=self.user, sender=self.my_user, content=f'You have been invited to workspace: {self.workspace.name}')



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
        if commit:
            instance = super().save(commit=False)
            instance.workspace = self.workspace
            
            for _ in range(5): # In practice, its very rare that it runs a second time, let alone 5 times
                invite_code = generate_workspace_invite_code()
                if not WorkspaceInviteCode.objects.filter(invite_code=invite_code).exists():
                    instance.invite_code = invite_code
                    break
            instance.save()



class EditInviteCodePasswordForm(forms.ModelForm):
    class Meta:
        model = WorkspaceInviteCode
        fields = ['password']





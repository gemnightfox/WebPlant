from django.shortcuts import get_object_or_404, render, redirect
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_POST
from django.utils import timezone
from .forms import PreferenceForm
from base_utils import CustomTokenGenerator, reusable_form_submission
from notification.utils import send_email
from django.contrib.messages import get_messages
from notification.models import NotificationDisabledDuration
from django.http import JsonResponse, Http404
from django.contrib.auth import get_user_model
from django.urls import reverse
from workspace.models import Workspace
from .utils import transfer_workspace_ownership_to_successor, get_preferences



@login_required
def dashboard(request):
    notification_disabled_duration = NotificationDisabledDuration.objects.filter(user=request.user).first()
    if notification_disabled_duration and notification_disabled_duration.ends_at < timezone.now(): # Deletes if expired
        notification_disabled_duration.delete()
        notification_disabled_duration = None
    
    messages = get_messages(request)
    for _ in messages:
        pass # Iterates through all messages to delete them (messages are currently not being used anywhere)
    return render(request, 'accounts/dashboard.html', {'notification_disabled_duration': notification_disabled_duration})



@login_required
def check_password_present(request): # Accounts which used Google login may not have usable local password set up yet
    return JsonResponse({'is_password_present': request.user.has_usable_password()})



@login_required
@require_POST
def send_account_deletion_email(request):
    token_generator = CustomTokenGenerator(purpose='delete-account')
    token = token_generator.make_token(request.user)
    path = reverse('accounts:delete_account', kwargs={
        'user_pk': request.user.pk,
        'token': token,
    })
    link = request.build_absolute_uri(path)
    content = f'We have received a request to permanently DELETE your account.\nIf you did NOT request to DELETE your account, please change your login credentials immediately.\nIf you made this request, please click the link below:\n\n{link}\n\nThis link will expire after some time due to security reasons.'
    send_email(receiver=request.user, sender=request.user, content=content, save_to_db=False)
    return JsonResponse({'status': 'success'})



# No login required to delete account
# Note: Since all owned workspaces need to be deleted before the user can be deleted, its a lot harder to delete users from the default Django admin page (URL: /admin/)
def delete_account(request, user_pk, token):
    user = get_object_or_404(get_user_model(), pk=user_pk)
    token_generator = CustomTokenGenerator(purpose='delete-account')
    is_token_valid = token_generator.check_token(user, token)

    if not is_token_valid: # IMPORTANT STEP (verifying account deletion token)
        raise Http404('Token is not valid')
    
    if request.method == 'POST':
        owned_workspaces = Workspace.objects.filter(owner__user=user)
        for workspace in owned_workspaces:
            transfer_workspace_ownership_to_successor(owner=user, workspace=workspace)

        user.delete() # Due to models.RESTRICT, all workspace ownerships have to be transferred before deleting user
        return redirect('home:home')
    return render(request, 'accounts/delete_account.html')



@login_required
@require_POST
def set_preferences(request):
    preferences = get_preferences(request.user)
    return reusable_form_submission(request, PreferenceForm, instance=preferences)






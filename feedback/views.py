from django.contrib.auth.decorators import login_required
from django.shortcuts import render, redirect
from .forms import FeedbackForm



@login_required
def dashboard(request):
    if request.method == 'POST':
        form = FeedbackForm(request.POST, current_user=request.user)
        if form.is_valid():
            form.save()
            return redirect('feedback:dashboard')
    else:
        form = FeedbackForm(current_user=request.user)
    return render(request, 'feedback/index.html', {'form': form})




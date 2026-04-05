from django import forms
from .models import Feedback



class FeedbackForm(forms.ModelForm):
    class Meta:
        model = Feedback
        fields = ['content']

    def __init__(self, *args, current_user, **kwargs):
        super().__init__(*args, **kwargs)
        self.current_user = current_user

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.user = self.current_user

        if commit:
            instance.save()
        return instance




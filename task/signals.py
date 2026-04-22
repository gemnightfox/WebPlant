from django.db.models.signals import post_delete
from django.dispatch import receiver
from .models import TaskAttachment
from django.conf import settings
import cloudinary.uploader



@receiver(post_delete, sender=TaskAttachment)
def delete_cloudinary_image(sender, instance, **kwargs):
    if settings.CLOUDINARY_URL:
        cloudinary.uploader.destroy(public_id=instance.file.public_id, resource_type=instance.file.resource_type)








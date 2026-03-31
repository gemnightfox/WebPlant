from django.db import models
import uuid



class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey('workspace.Workspace', on_delete=models.CASCADE, related_name='projects')
    name = models.CharField(max_length=300)
    created_at = models.DateTimeField(auto_now_add=True)





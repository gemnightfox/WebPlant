from channels.generic.websocket import AsyncWebsocketConsumer
from .utils import get_project_or_404
import json
from channels.db import database_sync_to_async



class ProjectUpdate(AsyncWebsocketConsumer):
    async def connect(self):
        my_user = self.scope['user']
        if not my_user.is_authenticated:
            await self.close()
            return
        self.my_user = my_user

        self.project_id = self.scope['url_route']['kwargs']['project_id']
        self.project = await database_sync_to_async(get_project_or_404)(my_user=my_user, project_id=self.project_id)
        self.group_name = f'project_update_{self.project.id}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name,
        )
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name,
        )
    
    async def receive(self, text_data):
        action = json.loads(text_data)['action'] # 'create' OR 'edit' OR 'delete'
        await self.channel_layer.group_send(self.group_name, {'type': 'update_project', 'action': action})

    async def update_project(self, event):
        action = event['action']
        data = {
            'status': 'success',
            'object_type': 'project',
            'object_id': str(self.project_id),
            'action': action,
            'message': 'Project data has been updated by other users. Update the frontend data.',
            }
        data = json.dumps(data)
        await self.send(text_data=data)




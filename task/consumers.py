from channels.generic.websocket import AsyncWebsocketConsumer
from .utils import get_task_or_404
import json
from channels.db import database_sync_to_async



class TaskUpdate(AsyncWebsocketConsumer):
    async def connect(self):
        my_user = self.scope['user']
        if not my_user.is_authenticated:
            await self.close()
            return
        self.my_user = my_user

        self.task_id = self.scope['url_route']['kwargs']['task_id']
        self.task = await database_sync_to_async(get_task_or_404)(my_user=my_user, task_id=self.task_id)
        self.group_name = f'task_update_{self.task.id}'

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
        await self.channel_layer.group_send(self.group_name, {'type': 'update_task', 'action': action})

    async def update_task(self, event):
        action = event['action']
        data = {
            'status': 'success',
            'object_type': 'task',
            'object_id': str(self.task_id),
            'action': action,
            'message': 'Task data has been updated by other users. Update the frontend data.',
            }
        data = json.dumps(data)
        await self.send(text_data=data)




from channels.generic.websocket import AsyncWebsocketConsumer
from .utils import get_group_or_404
import json
from channels.db import database_sync_to_async



class GroupUpdate(AsyncWebsocketConsumer):
    async def connect(self):
        my_user = self.scope['user']
        if not my_user.is_authenticated:
            await self.close()
            return
        self.my_user = my_user

        self.group_id = self.scope['url_route']['kwargs']['group_id']
        self.group = await database_sync_to_async(get_group_or_404)(my_user=my_user, group_id=self.group_id)
        self.group_name = f'group_update_{self.group.id}'

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
        await self.channel_layer.group_send(self.group_name, {'type': 'update_group', 'action': action})

    async def update_group(self, event):
        action = event['action']
        data = {
            'status': 'success',
            'object_type': 'group',
            'object_id': str(self.group_id),
            'action': action,
            'message': 'Group data has been updated by other users. Update the frontend data.',
            }
        data = json.dumps(data)
        await self.send(text_data=data)




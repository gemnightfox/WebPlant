## TaskUpdate (Websocket)
- Auto updates frontend when backend data changes for task data

**Connecting**: Connects users to a Websocket-group (linked to a task model object)
**Sending**: When a user edits a task object, the type of action (create/edit/delete) is sent to all other users (in the same Websocket-group)
**Receiving**: When users receive a Websocket response (from *Sending* section above), the frontend updates (AJAX + GET url 'task:get_data') based on the type of action (create/edit/delete)
**Disconnecting**: Leaves the Websocket-group (stops receiving data)



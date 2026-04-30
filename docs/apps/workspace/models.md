## WorkspaceUser
- Stores data about all users inside a workspace (eg. Have they accepted the invite `is_active=True/False`, what permissions do they have)



## Workspace
- Stores data about each workspace (eg. name of workspace). A workspace object (parent) can hold multiple project objects (children).



## WorkspaceInviteCode
> A workspace object (parent) can contain multiple WorkspaceInviteCode objects (children)
- Users can join a workspace using its invite code (if any, password is optional)



## WorkspaceRole
> A workspace object (parent) can contain multiple WorkspaceRole objects (children)
- Contains permissions given for each role in a workspace
- Default roles are provided during Workspace object creation



## WorkspaceLog
> A workspace object (parent) can contain multiple WorkspaceLog objects (children)
- Logs all create/edit/delete actions done to any projects/groups/tasks in the workspace




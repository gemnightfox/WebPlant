## get_workspace_or_404
1. Gets the workspace object
2. If no object found (ID not found), raises 404 error
3. If user is not allowed to access workspace (eg. user not inside workspace), raise 404 error
4. If nothing goes wrong, return the workspace object



## get_workspace_user_or_404
> Same as get_workspace_or_404, but for WorkspaceUser instead of Workspace



## get_workspace_role_or_404
> Same as get_workspace_or_404, but for WorkspaceRole instead of Workspace



## verify_workspace_role
1. If the user is the owner of the workspace, skip all checks below (return immediately)
2. Checks if the user's workspace role has the permissions to perform the given action. If not, raise an error immediately
3. If all checks pass, return the function (no errors)



## save_changes_to_workspace_logs
- Creates a WorkspaceLog object when a project/group/task object is created/edited/deleted
- Helper function used in Project/Group/Task models custom save methods
- Note: If `workspace_user` argument is None (eg. during default Django admin page), no WorkspaceLog objects are created







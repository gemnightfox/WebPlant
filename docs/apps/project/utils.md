## get_project_or_404
1. Gets the project object
2. If no object found (ID not found), raises 404 error
3. If user is not allowed to access project (eg. user not inside workspace), raise 404 error
4. If nothing goes wrong, return the project object



## duplicate_project_only
- Used to duplicate a project object (does not carry over tasks/groups, done by task.utils.duplicate_task_only and group.utils.duplicate_group_only respectively)





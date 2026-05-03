## Project
> Stores data about each project (eg. name of project). A project object (parent) can hold multiple group objects (children).
- Custom save method (`workspace_user` parameter required, don't call .save() with `workspace_user=None`)
    - Creates a WorkspaceLog object (create/edit). Note: Does not work during bulk operations (eg. bulk_create/bulk_update).
- Custom delete method (`workspace_user` parameter required, don't call .delete() with `workspace_user=None`)
    - Creates a WorkspaceLog object (delete). Note: Does not work during bulk operations (eg. calling .delete() on more than 1 object).
    - For WorkspaceLog objects, delete any reference to the Project object currently being deleted (self)



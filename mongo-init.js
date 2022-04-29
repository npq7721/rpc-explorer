db.createUser(
  {
    user: "rtmuser",
    pwd: "pass",
    roles: [
      {
        role: "readWrite",
        db: "rtmexplorer"
      }
    ]
  }
);
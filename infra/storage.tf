# Profile pictures live in the foundation's student-files bucket. This stack
# only looks the bucket up by name and lets the API's TASK role (the
# application code, not the ECS agent) sign upload/download URLs under the
# avatars/ prefix. Nothing else in the bucket is reachable from the API.

data "aws_s3_bucket" "student_files" {
  bucket = "${local.name}-student-files-${local.account_id}"
}

data "aws_iam_policy_document" "task_avatars" {
  statement {
    sid = "AvatarsReadWrite"
    # HeadObject (the "did the upload land?" check) needs s3:GetObject.
    actions   = ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"]
    resources = ["${data.aws_s3_bucket.student_files.arn}/avatars/*"]
  }
}

resource "aws_iam_role_policy" "task_avatars" {
  name   = "avatars"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task_avatars.json
}

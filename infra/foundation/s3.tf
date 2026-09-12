# Student files: avatars now, application documents for RAG later. Private
# forever. The browser uploads and downloads through presigned URLs minted
# by the API, so the bucket needs CORS but never public access.

resource "aws_s3_bucket" "student_files" {
  bucket = "${local.name}-student-files-${local.account_id}"

  # Learning mode: delete the bucket even if it still holds objects.
  force_destroy = var.learning_mode

  tags = { Name = "${local.name}-student-files" }
}

resource "aws_s3_bucket_public_access_block" "student_files" {
  bucket                  = aws_s3_bucket.student_files.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ACLs off entirely: the bucket owner owns every object, whoever uploaded it.
resource "aws_s3_bucket_ownership_controls" "student_files" {
  bucket = aws_s3_bucket.student_files.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_versioning" "student_files" {
  bucket = aws_s3_bucket.student_files.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "student_files" {
  bucket = aws_s3_bucket.student_files.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Versioning protects against accidental deletes; this keeps old versions
# from piling up forever, and cleans up abandoned multipart uploads.
resource "aws_s3_bucket_lifecycle_configuration" "student_files" {
  bucket     = aws_s3_bucket.student_files.id
  depends_on = [aws_s3_bucket_versioning.student_files]

  rule {
    id     = "expire-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 30
    }
    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

resource "aws_s3_bucket_cors_configuration" "student_files" {
  bucket = aws_s3_bucket.student_files.id

  cors_rule {
    allowed_origins = var.upload_allowed_origins
    allowed_methods = ["GET", "PUT"]
    allowed_headers = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
  }
}

# Refuse plaintext HTTP, even from inside AWS.
data "aws_iam_policy_document" "student_files" {
  statement {
    sid     = "DenyInsecureTransport"
    effect  = "Deny"
    actions = ["s3:*"]
    resources = [
      aws_s3_bucket.student_files.arn,
      "${aws_s3_bucket.student_files.arn}/*",
    ]
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    condition {
      test     = "Bool"
      variable = "aws:SecureTransport"
      values   = ["false"]
    }
  }
}

resource "aws_s3_bucket_policy" "student_files" {
  bucket     = aws_s3_bucket.student_files.id
  policy     = data.aws_iam_policy_document.student_files.json
  depends_on = [aws_s3_bucket_public_access_block.student_files]
}

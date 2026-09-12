# The container registry is foundational: every service pushes to it, so it
# belongs here rather than inside one service's stack. The repository
# already exists (created by infra/ in Stage 2 of the API milestone); it is
# adopted, not recreated. See import-ecr.tf and README.md "Adopting the
# registry".

resource "aws_ecr_repository" "api" {
  name = "${var.project}-api"

  # Tags are commit SHAs and must never be overwritten: an immutable tag is
  # the guarantee that "deployed sha X" means exactly one image forever.
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  # Learning mode: delete the repository even if it still holds images.
  # That removes the production API's images too; a manual run of the
  # Deploy API workflow pushes a fresh one afterwards.
  force_delete = var.learning_mode
}

# Keep the registry small: the last 20 images are plenty for rollbacks.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 20 most recent images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 20
      }
      action = { type = "expire" }
    }]
  })
}

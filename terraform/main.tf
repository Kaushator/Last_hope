provider "docker" {}

resource "docker_image" "last_hope" {
  name = "ghcr.io/${var.repo}/last_hope:latest"
  keep_locally = false
}

resource "docker_container" "last_hope" {
  name  = "last_hope_app"
  image = docker_image.last_hope.latest
  ports {
    internal = 4000
    external = 4000
  }
}

variable "repo" {
  description = "GitHub repo path user/repo"
}

output "container_id" {
  value = docker_container.last_hope.id
}

output "url" {
  value = "http://localhost:4000"
}

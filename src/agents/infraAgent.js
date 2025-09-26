import { execSync } from "child_process";
export function deployInfra() {
  execSync("docker build -t myapp .", { stdio: "inherit" });
  execSync("terraform init && terraform apply -auto-approve", { stdio: "inherit" });
}

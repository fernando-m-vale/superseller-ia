data "archive_file" "power_shutdown_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/power-shutdown"
  output_path = "${path.module}/../lambda/power-shutdown.zip"
}

data "archive_file" "power_startup_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/power-startup"
  output_path = "${path.module}/../lambda/power-startup.zip"
}

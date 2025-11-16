
data "aws_vpc" "main" {
  id = var.vpc_id
}

data "aws_subnets" "all" {
  filter {
    name   = "vpc-id"
    values = [var.vpc_id]
  }
}

data "aws_subnet" "all" {
  for_each = toset(data.aws_subnets.all.ids)
  id       = each.value
}

data "aws_route_tables" "all" {
  vpc_id = var.vpc_id
}

data "aws_route_table" "all" {
  for_each       = toset(data.aws_route_tables.all.ids)
  route_table_id = each.value
}

data "aws_internet_gateway" "main" {
  filter {
    name   = "attachment.vpc-id"
    values = [var.vpc_id]
  }
}

data "aws_route53_zone" "main" {
  name         = var.domain_name
  private_zone = false
}

locals {
  public_route_table_ids = [
    for rt_id, rt in data.aws_route_table.all : rt_id
    if length([
      for route in rt.routes : route
      if route.gateway_id == data.aws_internet_gateway.main.id
    ]) > 0
  ]

  subnet_route_table_map = merge([
    for rt_id, rt in data.aws_route_table.all : {
      for assoc in rt.associations : assoc.subnet_id => rt_id
      if assoc.subnet_id != null
    }
  ]...)

  public_subnet_ids = [
    for subnet_id, subnet in data.aws_subnet.all : subnet_id
    if contains(local.public_route_table_ids, lookup(local.subnet_route_table_map, subnet_id, ""))
  ]

  private_subnet_ids = [
    for subnet_id, subnet in data.aws_subnet.all : subnet_id
    if !contains(local.public_route_table_ids, lookup(local.subnet_route_table_map, subnet_id, ""))
  ]

  public_subnets_by_az = {
    for subnet_id in local.public_subnet_ids :
    data.aws_subnet.all[subnet_id].availability_zone => subnet_id...
  }

  alb_subnet_ids = [
    for az, subnet_ids in local.public_subnets_by_az :
    subnet_ids[0]
  ]

  private_subnets_by_az = {
    for subnet_id in local.private_subnet_ids :
    data.aws_subnet.all[subnet_id].availability_zone => subnet_id...
  }

  ecs_subnet_ids = [
    for az, subnet_ids in local.public_subnets_by_az :
    subnet_ids[0]
  ]

  rds_subnet_ids = [
    for az, subnet_ids in local.private_subnets_by_az :
    subnet_ids[0]
  ]
}

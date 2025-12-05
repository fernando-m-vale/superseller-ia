# =============================================================================
# NAT Gateway - Permite que subnets privadas acessem a internet
# =============================================================================
# Necessário para que o App Runner (via VPC Connector) consiga fazer
# requisições HTTP para APIs externas (ex: api.mercadolibre.com)
#
# CUSTO: ~$32/mês (Elastic IP + NAT Gateway + Data Transfer)
# =============================================================================

# -----------------------------------------------------------------------------
# Elastic IP para o NAT Gateway
# -----------------------------------------------------------------------------
resource "aws_eip" "nat" {
  count  = var.enable_nat_gateway ? 1 : 0
  domain = "vpc"

  tags = merge(local.common_tags, {
    Name = "superseller-prod-nat-eip"
  })

  depends_on = [data.aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# NAT Gateway em uma Subnet Pública
# -----------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = local.public_subnet_ids[0]

  tags = merge(local.common_tags, {
    Name = "superseller-prod-nat-gw"
  })

  depends_on = [data.aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# Identificar Route Tables das Subnets Privadas
# -----------------------------------------------------------------------------
# As subnets privadas já possuem Route Tables associadas.
# Vamos adicionar apenas a rota para o NAT Gateway nessas Route Tables.

locals {
  # Obtém os IDs das Route Tables das subnets privadas
  private_route_table_ids = distinct([
    for subnet_id in local.private_subnet_ids :
    lookup(local.subnet_route_table_map, subnet_id, null)
    if lookup(local.subnet_route_table_map, subnet_id, null) != null
  ])
}

# -----------------------------------------------------------------------------
# Adicionar Rota para NAT Gateway nas Route Tables Privadas
# -----------------------------------------------------------------------------
# Isso NÃO cria novas associações, apenas adiciona a rota 0.0.0.0/0 -> NAT
# nas Route Tables que já estão associadas às subnets privadas.

resource "aws_route" "private_nat" {
  count = var.enable_nat_gateway ? length(local.private_route_table_ids) : 0

  route_table_id         = local.private_route_table_ids[count.index]
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.main[0].id
}

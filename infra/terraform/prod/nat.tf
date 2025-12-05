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

  # Garante que o IGW existe antes de criar o EIP
  depends_on = [data.aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# NAT Gateway em uma Subnet Pública
# -----------------------------------------------------------------------------
resource "aws_nat_gateway" "main" {
  count         = var.enable_nat_gateway ? 1 : 0
  allocation_id = aws_eip.nat[0].id
  subnet_id     = local.public_subnet_ids[0] # Primeira subnet pública

  tags = merge(local.common_tags, {
    Name = "superseller-prod-nat-gw"
  })

  depends_on = [data.aws_internet_gateway.main]
}

# -----------------------------------------------------------------------------
# Route Table para Subnets Privadas (com rota para NAT)
# -----------------------------------------------------------------------------
resource "aws_route_table" "private" {
  count  = var.enable_nat_gateway ? 1 : 0
  vpc_id = var.vpc_id

  # Rota para internet via NAT Gateway
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[0].id
  }

  tags = merge(local.common_tags, {
    Name = "superseller-prod-private-rt"
  })
}

# -----------------------------------------------------------------------------
# Associar Route Table às Subnets Privadas
# -----------------------------------------------------------------------------
resource "aws_route_table_association" "private" {
  count          = var.enable_nat_gateway ? length(local.private_subnet_ids) : 0
  subnet_id      = local.private_subnet_ids[count.index]
  route_table_id = aws_route_table.private[0].id
}


output "resource_group_name" {
  value       = azurerm_resource_group.rg.name
  description = "The name of the Resource Group."
}

output "resource_group_id" {
  value       = azurerm_resource_group.rg.id
  description = "The ID of the Resource Group."
}

output "virtual_network_name" {
  value       = azurerm_virtual_network.vnet.name
  description = "The name of the Virtual Network."
}

output "virtual_network_id" {
  value       = azurerm_virtual_network.vnet.id
  description = "The ID of the Virtual Network."
}

output "subnet_name" {
  value       = azurerm_subnet.subnet.name
  description = "The name of the Subnet."
}

output "subnet_id" {
  value       = azurerm_subnet.subnet.id
  description = "The ID of the Subnet."
}

output "nsg_name" {
  value       = azurerm_network_security_group.nsg.name
  description = "The name of the Network Security Group."
}

output "nsg_id" {
  value       = azurerm_network_security_group.nsg.id
  description = "The ID of the Network Security Group."
}

output "public_ip_address" {
  value       = azurerm_public_ip.pip.ip_address
  description = "The dynamic Public IP address associated with the VM (available post-allocation)."
}

output "public_ip_id" {
  value       = azurerm_public_ip.pip.id
  description = "The ID of the Public IP."
}

output "vm_name" {
  value       = azurerm_linux_virtual_machine.vm.name
  description = "The name of the Linux Virtual Machine."
}

output "vm_id" {
  value       = azurerm_linux_virtual_machine.vm.id
  description = "The ID of the Linux Virtual Machine."
}

output "vm_private_ip" {
  value       = azurerm_network_interface.nic.private_ip_address
  description = "The private IP address of the Virtual Machine."
}

output "vm_admin_username" {
  value       = var.vm_admin_username
  description = "The VM administrator username."
}

output "vm_password" {
  value       = random_password.vm_password.result
  description = "The generated administrator password for the VM."
  sensitive   = true
}

output "storage_account_name" {
  value       = azurerm_storage_account.sa.name
  description = "The name of the Storage Account."
}

output "storage_account_id" {
  value       = azurerm_storage_account.sa.id
  description = "The ID of the Storage Account."
}

output "log_analytics_workspace_name" {
  value       = azurerm_log_analytics_workspace.law.name
  description = "The name of the Log Analytics Workspace."
}

output "log_analytics_workspace_id" {
  value       = azurerm_log_analytics_workspace.law.id
  description = "The ID of the Log Analytics Workspace."
}

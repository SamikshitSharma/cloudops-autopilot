variable "subscription_id" {
  type        = string
  description = "The target Azure subscription ID."
  default     = "5056204e-296f-41cb-b389-b2c747b62c20"
}

variable "location" {
  type        = string
  description = "The Azure Region to deploy resources."
  default     = "eastus"
}

variable "prefix" {
  type        = string
  description = "Prefix applied to all demo resource names."
  default     = "cloudops-demo"
}

variable "vm_size" {
  type        = string
  description = "The SKU size of the Virtual Machine."
  default     = "Standard_B1s"
}

variable "vm_admin_username" {
  type        = string
  description = "Admin username for VM login."
  default     = "azureuser"
}

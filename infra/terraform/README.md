# CloudOps Autopilot Azure Infrastructure

This directory contains the production-quality Terraform configuration to provision a minimal, cost-efficient, and complete CloudOps demo environment in Azure.

## Provisioned Resources

The Terraform configuration deploys the following resources in a single resource group:

1. **Resource Group**: Central container for the demo resources.
2. **Virtual Network (VNet)**: Address space `10.0.0.0/16`.
3. **Subnet**: Subnet range `10.0.1.0/24`.
4. **Network Security Group (NSG)**: Configured with an inbound rule allowing port 22 (SSH) traffic.
5. **Public IP**: Dynamic public IP to provide external connectivity to the VM.
6. **Network Interface (NIC)**: Binds the VM, subnet, and NSG.
7. **Virtual Machine**: A single `Standard_B1s` Ubuntu Linux Virtual Machine with a dynamically generated random password (SSH password authentication enabled).
8. **Storage Account**: General purpose V2 Storage Account with Standard LRS replication.
9. **Log Analytics Workspace**: Monitoring tier for timeseries and telemetry storage.

---

## Deployment Instructions

### Prerequisites
1. [Terraform CLI](https://developer.hashicorp.com/terraform/downloads) (v1.0.0+) installed locally.
2. [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) installed and authenticated.

### Step 1: Authentication
Before running Terraform, log in to your Azure CLI session and set the active subscription:
```bash
az login
az account set --subscription "5056204e-296f-41cb-b389-b2c747b62c20"
```

### Step 2: Initialization
Initialize the directory to download provider plug-ins (AzureRM and Random):
```bash
terraform init
```

### Step 3: Validation
Validate the syntactic correctness of the configuration:
```bash
terraform validate
```

### Step 4: Plan Execution
Preview the infrastructure plan:
```bash
terraform plan
```

### Step 5: Provision Infrastructure
Deploy the resources:
```bash
terraform apply
```

### Step 6: Access VM Password
To view the generated sensitive password, run:
```bash
terraform output -json vm_password
```

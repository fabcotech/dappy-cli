## Dappy CLI

NodeJS utility to publish dapp and manage zone and records in the dappy name system

Commands and workflow are explained in the dappy documentation.

[docs.dappy.tech](https://docs.dappy.tech/)

### Commands

```sh
npx @fabcotech/dappy-cli init
npx @fabcotech/dappy-cli generateprivatekey
npx @fabcotech/dappy-cli printpublickey
```

Checking if `dappy.config.json` is up to date with remote blockchain (dappy network) state.

```sh
npx @fabcotech/dappy-cli status
```

Update all the zones that need to be updated

```sh
npx @fabcotech/dappy-cli push
```

Generating key pairs (openssl must be installed)

```sh
# Generate a key pair (cert + key) for all hosts (A or AAAA) inside a domain
npx @fabcotech/dappy-cli generatecerts --domain example.gamma

# Generate a key pair (cert + key) for arbitrary hosts
npx @fabcotech/dappy-cli generatecerts --hosts example.gamma+foo.example.gamma+another.gamma
```

Apply a CERT record to `dappy.config.json`.

```sh
# Apply to all hosts (A or AAAA record) inside a domain
npx @fabcotech/dappy-cli apply --cert group1.crt --domain example.gamma

# Apply to specific hosts
npx @fabcotech/dappy-cli apply --cert group1.crt --hosts example.gamma+foo.example.gamma+another.gamma
```

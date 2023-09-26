![dappy cli large image](https://raw.githubusercontent.com/fabcotech/dappy-cli/master/assets/dappycli.jpg)

Command line interface written in nodeJS that helps you manage a zone in the dappy name system. You can add new TLS certificates (self-signed, no CA), domain names, subdomains and TXT records, vizualize all of your domains in a tree like fashion and much more !

Commands and workflow are explained in the [dappy documentation](https://docs.dappy.tech/). You may obtain production domains at [app.dappy.tech](https://app.dappy.tech/), and test domains for free at [gamma.dappy.tech/now](https://gamma.dappy.tech/now).

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

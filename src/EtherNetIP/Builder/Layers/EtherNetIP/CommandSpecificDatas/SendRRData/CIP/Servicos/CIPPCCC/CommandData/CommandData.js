import { TraceLog } from "../../../../../../../../../Utils/TraceLog.js";
import { hexDeBuffer, numeroToHex } from "../../../../../../../../../Utils/Utils.js";
import { ProtectedTyped3AddressBuilder } from "./FunctionSpecificCodes/ProtectedTyped3Address.js";

/**
 * Instancia um Builder pra configurar um comando PCCC
 */
export class PCCCCommandDataBuilder {

    #campos = {
        /**
         * O comando PCCC a ser executado
         * @type {Number}
         */
        comando: undefined,
        /**
         * O código de transação(Não sei o que é exatamente ainda)
         * @type {Buffer}
         */
        transactionCode: undefined,
        /**
         * Código da função do comando
         * @type {Number}
         */
        codigoFuncao: undefined,
        /**
         * Algum Builder pronto específico de Function Specific Data. (Se for informado o custom Function Specific Data esse campo é ignorado)
         * @type {ProtectedTyped3AddressBuilder}
         */
        functionSpecificData: undefined,
        /**
         * Buffer bruto para enviar no lugar do Function Specific Data (Opcional também)
         * @type {Buffer}
         */
        customFunctionSpecificDataBuff: undefined
    }

    /**
     * Instanciar o construtor
     */
    constructor() {
        return this;
    }

    /**
     * Seta o comando que será executado nesse PCCC. Cada comando tem um código específico
     * 
     * Na [documentação DF1](https://literature.rockwellautomation.com/idc/groups/literature/documents/rm/1770-rm516_-en-p.pdf) contém os códigos de comandos e funções pra cada ação desejada
     * 
     * **SEGUNDO O MANUAL É PERIGOSO USAR COMANDOS QUE NÂO SEJAM OS PADRÕES DEFINIDOS E PODE CAUSAR COMPORTAMENTOS NÂO ESPERADOS**
     * 
     * Cada bit do comando indica uma configuração do comando, sendo(bits da direita pra esquerda):
     ** 0-3 bits: código do comando
     ** 4 bit: sempre 0 segundo o manual
     ** 5 bit: prioridade, 0= normal, 1= alta
     ** 6 bit: indica se é uma solicitação ou uma ressposta, 0= solicitação, 1= resposta
     ** 7 bit: sempre 0 segundo o manual
     * @param {Number} codigo - Código do comando 
     */
    setCommandCode(codigo) {
        if (isNaN(codigo)) throw new Error(`O código de comando deve ser um número`);
        this.#campos.comando = codigo;
    }

    /**
     * Setar como um comando pre-definido da lista de comandos existentes
     * @param {"ProtectedTypedRead3Address"|"ProtectedTypedWrite3Address"} comando - O comando pre-definido
     * - `"ProtectedTypedRead3Address"`: Ler um endereço lógico
     * - `"ProtectedTypedWrite3Address"`: Escrever um endereço lógico
     */
    setAsCommand(comando) {
        if (comando == undefined) throw new Error(`O comando não pode ser nulo`);

        let comandoPronto = ComandosProntos[comando];
        if (comandoPronto == undefined) throw new Error(`O comando ${comando} não é um comando válido`);

        this.#campos.comando = comandoPronto.codigoComando;
        this.#campos.codigoFuncao = comandoPronto.codigoFuncao;
    }

    /**
     * Setar o código de transação(Segundo o manual pelo que li, esse código é retornado pelo dispositivo pra min, assim consigo dar track na resposta, porém eu não preciso pq ja uso o Sender Context do ENIP pra isso)
     * @param {Buffer} codigo 
     */
    setTransactionCode(codigo) {
        if (codigo == undefined) throw new Error(`O código de transação não pode ser nulo`);
        if (!Buffer.isBuffer(codigo)) throw new Error(`O código de transação deve ser um Buffer`);
        if (codigo.length !== 2) throw new Error(`O código de transação deve ter 2 bytes`);

        this.#campos.transactionCode = codigo;
    }

    /**
     * O código da função é "casado" com o código do comando, por exemplo, a leitura de endereço pode ser o comando 0F e a função 03, mas se for informado outro comando, a função 03 não será válida.
     * 
     * Na [documentação DF1](https://literature.rockwellautomation.com/idc/groups/literature/documents/rm/1770-rm516_-en-p.pdf) contém os códigos de comandos e funções pra cada ação desejada
     * 
     * **SEGUNDO O MANUAL É PERIGOSO USAR COMANDOS QUE NÂO SEJAM OS PADRÕES DEFINIDOS E PODE CAUSAR COMPORTAMENTOS NÂO ESPERADOS**
     */
    setFunctionCode(codigo) {
        this.#campos.codigoFuncao = codigo;
    }

    /**
     * Setar o Function Specific Data para o Builder do Protected Typed 3 Address. Ele é usado para Writes e Reads de endereços lógicos
     * 
     * Configure os parametros retornados nesse Builder para solicitar leituras/escritas de endereços
     * @param {'Read' | 'Write'} acao - Ação que será executada no endereço lógico.
     * 
     * - `'Read'`: Seta o Command Code para 0x0F e o Function Code para 0xA2
     * - `'Write'`: Seta o Command Code para 0x0F e o Function Code para 0xAA
     * 
     * @returns {ProtectedTyped3AddressBuilder} Retorna o Builder do Protected Typed 3 Address para configurar o endereço lógico
     */
    setAsCommandProtectedTyped3Address(acao) {
        switch (acao.toLowerCase()) {
            case 'read': {
                let comandoPronto = ComandosProntos.ProtectedTypedRead3Address;

                this.setCommandCode(comandoPronto.codigoComando);
                this.setFunctionCode(comandoPronto.codigoFuncao);
                break;
            }
            case 'write': {
                let comandoPronto = ComandosProntos.ProtectedTypedWrite3Address;

                this.setCommandCode(comandoPronto.codigoComando);
                this.setFunctionCode(comandoPronto.codigoFuncao);
                break;
            }
            default: {
                throw new Error(`A ação ${acao} não é válida para um Protected Typed 3 Address. Ações validas são somente Read e Write`);
            }
        }

        this.#campos.functionSpecificData = new ProtectedTyped3AddressBuilder();

        return this.#campos.functionSpecificData;
    }

    /**
     * Setar o Function Specific Data para um Buffer customizado de sua escolha.
     * 
     * Geralmente, os campos setados pelas funções configuram a criação do Buffer do Function Specific Data, porém, se você deseja enviar um buffer customizado, pode ignorar todos os metodos e setar o buffer diretamente
     * 
     * **SEGUNDO O MANUAL É PERIGOSO USAR COMANDOS QUE NÂO SEJAM OS PADRÕES DEFINIDOS E PODE CAUSAR COMPORTAMENTOS NÂO ESPERADOS**
     * 
     * @param {Buffer} buff - Buffer com os dados específicos da função
     */
    setFunctionSpecificDataBuffer(buff) {
        if (buff == undefined) throw new Error(`O buffer de dados específicos da função não pode ser nulo`);
        if (!Buffer.isBuffer(buff)) throw new Error(`O buffer de dados específicos da função deve ser um Buffer`);

        this.#campos.customFunctionSpecificDataBuff = buff;
    }

    /**
     * Criar o Buffer do PCCC Command Data
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do CIP Connection Manager
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            },
            /**
             * O tracer de logs contém as etapas da geração do buffer.
             * @type {TraceLog}
             */
            tracer: new TraceLog()
        }

        const tracerBuffer = retBuff.tracer.addTipo(`CIP PCCC Command Data BUilder`);

        tracerBuffer.add(`Iniciando a criação do buffer do PCCC Command Data`);

        // Alocar os bytes pro cabeçalho do Command Data
        // 1 Byte = Command Code
        // 1 Byte = Código de Status
        // 2 Bytes = Transaction Code
        // 1 Byte = Código de Função
        const bufferCabecalho = Buffer.alloc(5);

        tracerBuffer.add(`Criando um Buffer de ${bufferCabecalho.length} bytes para o cabeçalho do PCCC Command Data`);

        // O código do comando é obrigatorio especificar
        if (this.#campos.comando == undefined) {
            tracerBuffer.add(`O comando não foi definido. Não é possível prosseguir com a geração do Buffer`);
            retBuff.erro.descricao = `O comando não foi definido. Não é possível prosseguir com a geração do Buffer`;
            return retBuff;
        }

        // O código da função também é obrigatorio, pois o comando PCCC é compost do código + função
        if (this.#campos.codigoFuncao == undefined) {
            tracerBuffer.add(`O código de função não foi definido. Não é possível prosseguir com a geração do Buffer`);
            retBuff.erro.descricao = `O código de função não foi definido. Não é possível prosseguir com a geração do Buffer`;
            return retBuff;
        }

        // O código da transação é tipo um ID que eu envio e recebo novamente pra identificar as respostas, porém, eu não preciso disso pq ja uso o Sender Context do ENIP pra isso
        // É opcional informar
        if (this.#campos.transactionCode == undefined) {

            let bufferTransaction = Buffer.alloc(2);

            // Setar um numero aleatorio entre 0 500. Não sei se o dispositivo remoto vai dar problema se enviar duas requisições rapidas com a mesma transaction, então eu gero um random pra garantir.
            bufferTransaction.writeUInt16LE(Math.floor(Math.random() * 500), 0);

            tracerBuffer.add(`O código de transação não foi definido. Gerando um código aleatorio de transação: ${hexDeBuffer(bufferTransaction)}`);
            this.#campos.transactionCode = bufferTransaction
        }

        // Setar o Command Code
        bufferCabecalho.writeUInt8(this.#campos.comando, 0);
        tracerBuffer.add(`Setando o campo Command Code para ${this.#campos.comando} (${numeroToHex(this.#campos.comando, 1)}) no offset 0`);

        // Setar o Código de Status pra sucesso ja que é uma request
        bufferCabecalho.writeUInt8(0x00, 1);
        tracerBuffer.add(`Setando o campo Código de Status para 0x00 no offset 1`);

        // Setar o Transaction Code
        this.#campos.transactionCode.copy(bufferCabecalho, 2);
        tracerBuffer.add(`Setando o campo Transaction Code para (${hexDeBuffer(this.#campos.transactionCode)}) no offset 2`);

        // Setar o Código de Função
        bufferCabecalho.writeUInt8(this.#campos.codigoFuncao, 4);
        tracerBuffer.add(`Setando o campo Código de Função para ${this.#campos.codigoFuncao} (${numeroToHex(this.#campos.codigoFuncao, 1)}) no offset 4`);

        tracerBuffer.add(`Cabeçalho do PCC Command Data gerado: ${hexDeBuffer(bufferCabecalho)}. Total de ${bufferCabecalho.length} bytes. Prosseguindo para adicionar o Function Specific Data...`);

        let bufferCommandSpecificData = Buffer.alloc(0);
        
        // Se foi definido um buffer customizado, utilizar ele no function specific data
        if (this.#campos.customFunctionSpecificDataBuff != undefined) {
            tracerBuffer.add(`Foi definido um buffer customizado para o Function Specific Data: ${hexDeBuffer(this.#campos.customFunctionSpecificDataBuff)}, com um total de ${this.#campos.customFunctionSpecificDataBuff.length} bytes`);
            bufferCommandSpecificData = this.#campos.customFunctionSpecificDataBuff;
        } else {

            // Se foi definido um Builder do Function Specific Data, preciso validar se foi informado um Builder valido.
            if (this.#campos.functionSpecificData != undefined) {

                // Se foi definido um Function Specific Data, gerar o buffer dele
                if (this.#campos.functionSpecificData instanceof ProtectedTyped3AddressBuilder) {

                    tracerBuffer.add(`Foi definido um Function Specific Data do tipo Protected Typed 3 Address. Gerando o buffer...`)

                    /**
                     * @type {ProtectedTyped3AddressBuilder}
                     */
                    let protectedType3Add = this.#campos.functionSpecificData;

                    const retGeraBuff = protectedType3Add.criarBuffer();

                    retBuff.tracer.appendTraceLog(retGeraBuff.tracer);
                    if (!retGeraBuff.isSucesso) {
                        tracerBuffer.add(`O Builder ProtectedTyped3AddressBuilder não conseguiu gerar o Buffer, motivo: ${retGeraBuff.erro.descricao}`);

                        retBuff.erro.descricao = `Erro ao gerar o Function Specific Data do tipo Protected Typed 3 Address: ${retGeraBuff.erro.descricao}`;
                    }

                    // Se gerou com sucesso, appendar ao Buffer do Command Specific Data
                    bufferCommandSpecificData = retGeraBuff.sucesso.buffer;
                } else {
                    tracerBuffer.add(`O Function Specific Data definido não se encaixa em nenhum Builder valido. Não é possível prosseguir com a geração do Buffer..`);

                    retBuff.erro.descricao = `O Function Specific Data definido não se encaixa em nenhum Builder valido. Não é possível prosseguir com a geração do Buffer..`;
                    return retBuff;
                }
            } else {
                tracerBuffer.add(`Não foi definido um Function Specific Data(nem customizado nem um Builder). O Function Specific Data não será incluido no Buffer`);
            }
        }

        // Juntar o cabeçalho com o Command Specific Data desejado
        const bufferCompleto = Buffer.concat([bufferCabecalho, bufferCommandSpecificData]);

        tracerBuffer.add(`Buffer do PCCC Command Data gerado com sucesso: ${hexDeBuffer(bufferCompleto)}. Total de ${bufferCompleto.length} bytes`);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = bufferCompleto;
        return retBuff;
    }
}

export const ComandosProntos = {
    /**
     * Esse comando e função servem pra ler um endereço lógico do controlador
     */
    ProtectedTypedRead3Address: {
        codigoComando: 0x0f,
        codigoFuncao: 0xa2
    },
    /**
     * Esse comando e função servem pra escrever um endereço lógico no controlador
     */
    ProtectedTypedWrite3Address: {
        codigoComando: 0x0f,
        codigoFuncao: 0xaa
    }
}
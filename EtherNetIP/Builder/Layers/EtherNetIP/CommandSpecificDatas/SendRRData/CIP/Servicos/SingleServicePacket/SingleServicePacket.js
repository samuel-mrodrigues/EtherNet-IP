/**
 * O Single Service Packet é usado para solicitar o Request Path para um recurso especifico, como uma tag do dispositivo remoto com a descrição.
 */
export class SingleServicePacketServiceBuilder {
    /**
     * Campos utilizado pelo SingleServicePacket
     */
    #campos = {
        /**
         * Código do serviço do SingleServicePacket
         */
        codigoServico: undefined,
        /**
         * O que vai ser solicitado
         */
        atributoNome: '',
        /**
         * Se o tipo do serviço for pra pegar algum atributo, contém detalhes adicionais para enviar no CIP Class Generic especifico
         */
        getAtribute: {
            nome: undefined
        },
        /**
         * Se o tipo do serviço for pra setar algum atributo do path final, contém o que vai ser setado pra enviar no CIP Class Generic
         */
        setAttribute: {
            nome: undefined,
            /**
             * O Data Type do tipo do Path final(que por exemplo no caso seria a tag)
             */
            datatype: undefined,
            /**
             * O novo valor deve ser aplicado
             */
            valor: undefined
        }
    }

    /**
     * Opções de comportamento
     */
    #opcoes = {

    }

    /**
     * Instanciar o construtor do Single Service Packet
     * @param {Object} parametros - Parametros do construtor para instanciar o SIngleServicePacket
     * @param {Number} parametros.codigoServico - O código do serviço do Single Service Packet 
     * @param {String} parametros.string - O nome do recurso que vai ser solicitado no dispositivo remoto 
     */
    constructor(parametros) {
        if (parametros != undefined && typeof parametros == 'object') {

            if (parametros.string != undefined) this.setString(string);
            if (parametros.codigoServico != undefined) this.setCodigoServico(codigoServico);
        }

        return this;
    }

    /**
     * Definir a string do que vai ser solicitado no serviço
     * @param {String} string - O nome do recurso. Caso seja uma tag, informar tipo "MINHA_TAG"
     */
    setString(string) {
        this.#campos.atributoNome = string;

        return this;
    }

    /**
     * Obter a string do que vai ser solicitado no serviço
     */
    getStringPath() {
        return this.#campos.atributoNome;
    }

    /**
     * Define o codigo de serviço do Single Service Packet, que no caso seria um Get ou Set
     * @param {Number} codigo - Código valido do serviço Single Service Packet
     */
    setCodigoServico(codigo) {
        if (getSingleServiceCode(codigo) == undefined) {
            throw new Error(`Código de serviço informado '${codigo}' é inválido`);
        }

        this.#campos.codigoServico = codigo;
    }

    /**
     * Define o serviço como um Get Attribute
     * @param {Object} propriedades - Propriedades para incluir no Get Attribute
     * @param {String} propriedades.nome - O nome do recurso que vai ser solicitado no dispositivo remoto
     */
    setAsGetAttribute(propriedades) {
        this.setCodigoServico(SingleServiceCodes.Get.hex);

        // Verificar se o usuario informou as propriedades necessarias
        if (propriedades == undefined) throw new Error('Propriedades para Get Attribute não foram informadas. É necessario informar o nome do recurso que deseja solicitar');
        if (propriedades.nome == undefined) throw new Error('O nome do recurso que deseja solicitar deve ser informado');
        if (typeof propriedades.nome != 'string') throw new Error('O nome do recurso que deseja solicitar deve ser uma string');

        this.#campos.atributoNome = propriedades.nome;
    }

    /**
     * Define o serviço como um Set Attribute
     * @param {Object} propriedades - Propriedades para incluir no Set Attribute
     * @param {String} propriedades.nome - O nome do recurso que vai ser solicitado no dispositivo remoto
     * @param {Number} propriedades.datatype - O tipo do Data Type do valor que vai ser setado
     * @param {Number} propriedades.valor - O valor que vai ser setado-
     */
    setAsSetAttribute(propriedades) {
        this.setCodigoServico(SingleServiceCodes.Set.hex);

        // Verificar se o usuario informou as propriedades necessarias
        if (propriedades == undefined) throw new Error('Propriedades para Set Attribute não foram informadas. É necessario informar o DataType e o novo valor desejado');
        if (propriedades.datatype == undefined) throw new Error('O DataType deve ser informado');
        if (getDataType(propriedades.datatype) == undefined) throw new Error(`O DataType informado '${propriedades.datatype}' é inválido`);
        if (propriedades.nome == undefined) throw new Error('O nome do recurso que deseja setar deve ser informado');

        this.#campos.setAttribute.datatype = propriedades.datatype;
        this.#campos.setAttribute.valor = propriedades.valor;

        this.#campos.atributoNome = propriedades.nome;
        return this;
    }

    /**
     * Retorna o codigo de serviço configurado atual
     */
    getCodigoServico() {
        return this.#campos.codigoServico;
    }

    /**
     * Criar o buffer Request Path para o serviço Single Service Packet
     */
    criarBuffer() {
        const retBuff = {
            isSucesso: false,
            sucesso: {
                /**
                 * O Buffer com os dados do Single Service Packet
                 * @type {Buffer}
                 */
                buffer: undefined
            },
            erro: {
                descricao: ''
            }
        }

        // O cabeçalho do serviço Single Service Packet
        const bufferCabecalho = Buffer.alloc(2);

        // O 1 byte do cabeçalho é o tipo do service
        bufferCabecalho.writeUInt8(this.#campos.codigoServico, 0);

        // O 2 byte é o tamanho do Request Path abaixo em words
        bufferCabecalho.writeUInt8(Math.ceil((this.#campos.atributoNome.length + 2) / 2), 1);

        // Alocar um buffer pra caber o +1 byte do data type e o +1 Request Path 
        let valorParaAlocarBytes = 2 + Buffer.from(this.#campos.atributoNome).length;
        let isStringImpar = Buffer.from(this.#campos.atributoNome).length % 2 !== 0;
        if (isStringImpar) valorParaAlocarBytes += 1;  // Se o tamanho da string for ímpar, adicionar um byte de preenchimento

        const buffRequestPath = Buffer.alloc(valorParaAlocarBytes);

        // Definir o 1 byte como o data type String
        buffRequestPath.writeUInt8(0x91, 0);  // ANSI Extended Symbol Segment (0x91)

        // O próximo 1 byte é o tamanho em bytes do simbolo solicitado
        buffRequestPath.writeUInt8(Buffer.from(this.#campos.atributoNome).length, 1);

        // Os próximos bytes são o Request Path da string solicitada
        Buffer.from(this.#campos.atributoNome).copy(buffRequestPath, 2);

        // Dependendo do serviço solicitado, o CIP GenericData contém informações adicionais necessarias para executar alguma operação.
        // Gerlamente pro serviço Get, é só alocado um Buffer vazio 0x0100, e pro Set, é alocado um buffer com informações da tag que vai ser alterada, como o seu tipo, tamanho e novo valor;
        /**
         * @type {Buffer}
         */
        let bufferCIPGenericData;

        // Se for um Get, eu appendo um array de 2 bytes vazio ao CIP Generic Data
        if (this.isGetAttribute()) {
            bufferCIPGenericData = Buffer.from([0x01, 0x00]);
        } else {
            // Se for um Set, eu preciso atribuir o valor que vai ser setado

            // Pega o tipo do Data Type definido
            let dataTypeDefinido = getDataType(this.#campos.setAttribute.datatype);

            // Os tipos numericos começam do 193 a 202
            let isTipoNumero = dataTypeDefinido.codigo >= 193 && dataTypeDefinido.codigo <= 197;
            if (isTipoNumero) {

                // Se não foi informado o valor, no numero ele será por padrão 0;
                if (this.#campos.setAttribute.valor == undefined) {
                    this.#campos.setAttribute.valor = 0;
                }

                // Aloco 4 bytes, 2 pro tipo do Data Type e 2 pro tamanho;
                const bufferTipoDataType = Buffer.alloc(4);

                // Escrevo os primeiros 2 bytes pro tipo do Data Type
                bufferTipoDataType.writeUInt16LE(dataTypeDefinido.codigo, 0);

                // Os próximos 2 bytes, por algum motivo que não sei, se Data Type for um numero, o tamanho é 1
                bufferTipoDataType.writeUInt16LE(1, 2);

                // Alocar o tamanho do buffer necessario pra alocar o novo valor
                const bufferDataNovoValor = Buffer.alloc(dataTypeDefinido.tamanho);

                // Como o buffer é dependedo do tipo, verifico o tamanho e uso o Write apropriado
                try {
                    switch (dataTypeDefinido.tamanho) {
                        case 1: {
                            bufferDataNovoValor.writeUInt8(this.#campos.setAttribute.valor, 0);
                            break;
                        }
                        case 2: {
                            bufferDataNovoValor.writeUInt16LE(this.#campos.setAttribute.valor, 0);
                            break;
                        }
                        case 4: {
                            bufferDataNovoValor.writeUInt32LE(this.#campos.setAttribute.valor, 0);
                            break;
                        }
                        case 8: {
                            bufferDataNovoValor.writeBigInt64LE(this.#campos.setAttribute.valor, 0);
                            break;
                        }
                    }
                } catch (ex) {
                    retBuff.erro.descricao = `Erro ao escrever o Write no Buffer de ${dataTypeDefinido.tamanho} Bytes: ${ex.message}`;
                    return retBuff;
                }

                // Concatenar o buffer do tipo do Data Type com o buffer do novo valor

                bufferCIPGenericData = Buffer.concat([bufferTipoDataType, bufferDataNovoValor]);
            }

            // Com a informação do tipo do valor que vou escrever em mãos, escrever no buffer CIPGenericData
        }

        const buffFinal = Buffer.concat([bufferCabecalho, buffRequestPath, bufferCIPGenericData]);

        retBuff.isSucesso = true;
        retBuff.sucesso.buffer = buffFinal;

        // if (this.#opcoes.isIncluirCIPClassGeneric) {
        //     // Eu concateno o buffer com um byte de preenchimento que seria o CIP Class Generic
        //     retBuff.sucesso.buffer = Buffer.concat([bufferCabecalho, buff, Buffer.from([0x01, 0x00])]);
        // } else {
        //     // Se não precisar incluir o CIP Class Generic
        //     retBuff.sucesso.buffer = Buffer.concat([bufferCabecalho, buff]);
        // }

        return retBuff;
    }

    /**
     * Verifica se o serviço é um Get Attribute
     */
    isGetAttribute() {
        return this.#campos.codigoServico == SingleServiceCodes.Get.hex;
    }

    /**
     * Verifica se o serviço é um Set Attribute
     */
    isSetAttribute() {
        return this.#campos.codigoServico == SingleServiceCodes.Set.hex;
    }

    /**
     * Obter o Get Attribute configurado
     */
    getSetAttribute() {
        return this.#campos.setAttribute;
    }
}

export const SingleServiceCodes = {
    Get: {
        hex: 0x4c,
        descricao: 'Get_Attribute'
    },
    Set: {
        hex: 0x4d,
        descricao: 'Set_Attribute'
    }
}

/**
 * Tipos de DataTypes numericos suportados
 * Contém o código do tipo de dado, a descrição e o tamanho em bytes
 */
export const DataTypesNumericos = {
    BOOL: {
        codigo: 193,
        descricao: 'Boolean',
        tamanho: 1
    },
    SINT: {
        codigo: 194,
        descricao: 'Small Int',
        tamanho: 1
    },
    INT: {
        codigo: 195,
        descricao: 'Int',
        tamanho: 2
    },
    DINT: {
        codigo: 196,
        descricao: 'Double Int',
        tamanho: 4
    },
    LINT: {
        codigo: 197,
        descricao: 'Long Int',
        tamanho: 8
    },
    USINT: {
        codigo: 198,
        descricao: 'Unsigned Small Int',
        tamanho: 1
    },
    UINT: {
        codigo: 199,
        descricao: 'Unsigned Int',
        tamanho: 2
    },
    UDINT: {
        codigo: 200,
        descricao: 'Unsigned Double Int',
        tamanho: 4
    },
    REAL: {
        codigo: 202,
        descricao: 'Real',
        tamanho: 4
    }
}

/**
 * Tipos de DataTypes strings suportados
 * Contém o código do tipo de dado, a descrição e o tamanho em bytes
 */
export const DataTypesStrings = {
    
}

/**
 * Retorna informações de um Data Type
 * @param {Number} codigo 
 */
export function getDataType(codigo) {
    return Object.values(DataTypesNumericos).find((type) => type.codigo == codigo);
}

/**
 * Retorna o código do serviço Single Service Packet se existir
 * @param {Number} codigo 
 */
function getSingleServiceCode(codigo) {
    return Object.values(SingleServiceCodes).find((service) => service.hex == codigo);
}
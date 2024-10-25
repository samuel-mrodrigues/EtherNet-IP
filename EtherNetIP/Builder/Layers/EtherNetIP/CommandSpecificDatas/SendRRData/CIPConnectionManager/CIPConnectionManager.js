
//O layer CIP Connection Manager pelo menos para o Unconnected Message é composto dos seguintes campos:
// Primeiro 1 byte: Priority/Tick time no mesmo byte
// Próximo 1 byte

/**
 * Esse Layer vem após o layer CIP se o comando CIP utiliza o SendRRData(unconnected message) com a classe solicitada do Connection Manager
 ** Esse layer é composto também pelo Command Specific Data, que é variado dependendo do comando que foi solicitado
 */
export class CIPConnectionManagerBuilder {

    #campos = {
        /**
         * A prioridade do comando, geralmente sempre 0 meio que fds
         */
        priority: undefined,
        /**
         * Timeout kicks? Pelo nome parece ser oq eu penso mas por padrão deixo oq ta no manual que é 0x04
         */
        timeoutTicks: undefined,

    }   

    /**
     * Instanciar o layer CIP Connection Manager
     */
    constructor() {

    }

    
}
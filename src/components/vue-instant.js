import { mixin as clickaway } from 'vue-clickaway'
import { isPromise, isArray, isFunction } from '../utils/objectUtils'
import debounce from '../utils/debounce'

export default {
  name: 'vueInstant',
  mixins: [ clickaway ],
  props: {
    'value': {
      type: [String, Object],
      required: true
    },
    'suggestions': {
      type: [Array, Function],
      required: true
    },
    'suggestionAttribute': {
      type: String,
      required: true
    },
    findSimilar: {
      type: Boolean,
      default: true
    },
    allowSimilar: {
      type: Boolean,
      default: false
    },
    debounce: {
      type: Number,
      default: 500
    },
    'placeholder': {
      type: String,
      default: 'write something...'
    },
    'minMatch': {
      type: Number,
      default: 1
    },
    'name': {
      type: String,
      default: 'vueInstant'
    },
    'autofocus': {
      type: Boolean,
      default: true
    },
    'disabled': {
      type: Boolean
    },
    'showAutocomplete': {
      type: Boolean,
      default: true
    },
    'showPlaceholder': {
      type: Boolean,
      default: true
    },
    'suggestOnAllWords': {
      type: Boolean,
      default: false
    },
    'selectOnExact': {
      type: Boolean,
      default: true
    },
    'maxLimit': {
      type: Number,
      default: 0
    }
  },
  data () {
    return {
      selectedEventRaw: null,
      selectedSuggest: null,
      inputChanged: false,
      textVal: '',
      isSuggestionFn: false,
      suggestionsIsVisible: true,
      highlightedIndex: 0,
      similiarData: [],
      placeholderVal: this.placeholder,
      isLoading: false,
      findSuggestsCanceler: null,
      arrowKeysEvents: ['ArrowUp', 'ArrowDown', 'ArrowRight']
    }
  },
  watch: {
    placeholder: function (val) {
      if (this.textValIsEmpty()) {
        this.placeholderVal = val
      }
    },
    suggestions: function (val) {
      this.handleNewSuggestion(val)
    }
  },
  computed: {
    getPlaceholder () {
      if (this.inputChanged || this.textValIsEmpty()) {
        return this.placeholderVal
      }
    },
    showSuggestions () {
      return this.showAutocomplete && this.suggestionsIsVisible && this.similiarData.length >= this.minMatch
    },
    selectedEvent () {
      switch (this.selectedEventRaw) {
        case 'Up':
          return 'ArrowUp'
        case 'Down':
          return 'ArrowDown'
        case 'Left':
          return 'ArrowLeft'
        case 'Right':
          return 'ArrowRight'
        default:
          return this.selectedEventRaw
      }
    }
  },
  created () {
    if (typeof this.value === 'string') {
      this.textVal = this.value
    } else if (typeof value === 'object') {
      this.textVal = this.value[this.suggestionAttribute]
    } else {
      this.textVal = ''
    }
    this.handleNewSuggestion()
  },
  methods: {
    decrementHighlightedIndex () {
      this.highlightedIndex -= 1
    },
    incrementHighlightedIndex () {
      this.highlightedIndex += 1
    },
    handleNewSuggestion (val = this.suggestions) {
      this.isSuggestionFn = isFunction(val)
      if (this.isSuggestionFn) {
        this.getSuggestions = debounce(this.suggestions, this.debounce)
      }
      this.findSuggests()
    },
    handleAsyncSuggestion () {
      this.clearHighlightedIndex()
      const isExact = this.selectOnExact && this.onExact()
      if (isExact === false && this.suggestOnAllWords === false) this.setPlaceholderVal()
    },
    escapeAction () {
      this.clearHighlightedIndex()
      this.clearSimilarData()
      this.clearSelected()
      this.setBlur()
      this.emitEscape()
    },
    arrowRightAction () {
      this.setPlaceholderAndTextVal()
      this.emitKeyRight()
    },
    arrowDownAction () {
      if (this.arrowDownValidation()) {
        this.incrementHighlightedIndex()
        this.setPlaceholderAndTextVal()
        this.scrollHighlightedIntoView(false)
        this.emitKeyDown()
      }
    },
    arrowUpAction () {
      if (this.highlightedIndex > 0) {
        this.decrementHighlightedIndex()
        this.setPlaceholderAndTextVal()
        this.scrollHighlightedIntoView(true)
        this.emitKeyUp()
      } else {
        this.clearHighlightedIndex()
      }
    },
    scrollHighlightedIntoView (alignToTop) {
      this.$nextTick(() => {
        const highlightedEl = (this.$refs.suggestions && this.$refs.suggestions.querySelector('.sbx-searchbox__suggestion--highlighted')) || null
        if (!highlightedEl) return
        if (highlightedEl.scrollIntoViewIfNeeded) {
          highlightedEl.scrollIntoViewIfNeeded(false)
        } else {
          highlightedEl.scrollIntoView(alignToTop)
        }
      })
    },
    enterAction (e) {
      if (e) {
        this.setTextValue(e)
      }
      this.setFinalTextValue()
      this.clearHighlightedIndex()
      this.clearSimilarData()
      this.emitEnter()
    },
    selectedAction (index) {
      this.highlightedIndex = index
      this.setFinalTextValue()
      this.clearPlaceholder()
      this.clearSimilarData()
      this.select()
    },
    addRegister (o) {
      if (this.isSimilar(o) && this.textValIsNotEmpty()) {
        this.addSuggestion(o)
      }
    },
    addSuggestion (o) {
      if (this.allowSimilar || !this.findSuggestionTextIsRepited(o)) {
        this.addToSimilarData(o)
      }
    },
    addToSimilarData (o) {
      if (this.canAddToSimilarData()) {
        this.selectedSuggest = o
        // this.emitSelected()
        this.similiarData.push(o)
      }
    },
    setTextValue (e) {
      if (e.target.value.trim()) {
        this.textVal = e.target.value
        // this.emitChange()
      }
    },
    setFinalTextValue () {
      if (this.finalTextValueValidation()) {
        this.setPlaceholderAndTextVal()
        // this.emitChange()
      } else {
        this.clearAll()
      }
    },
    setPlaceholderAndTextVal () {
      const suggest = this.getSuggest()
      if (typeof suggest !== 'undefined') {
        this.setTextVal()
        this.setPlaceholderVal()
        this.selectedSuggest = suggest
        this.select()
      }
    },
    onExact () {
      const values = this.similiarData.map(item => item[this.suggestionAttribute])
      const index = values.findIndex(v => this.textVal === v)
      if (index !== -1) {
        this.highlightedIndex = index
        this.selectedSuggest = this.similiarData[index]
        this.clearPlaceholder()
        this.select()
        if (this.similiarData.length <= 1) {
          this.suggestionsIsVisible = false
        }
        return true
      }
      return false
    },
    setInitialPlaceholder () {
      this.placeholderVal = this.placeholder
    },
    setBlur () {
      this.$el.blur()
    },
    isHighlighted (index) {
      return this.highlightedIndex === index
    },
    letterProcess (o) {
      var remoteText = o.split('')
      var inputText = this.textVal.split('')
      inputText.forEach(function (letter, key) {
        if (letter !== remoteText[key]) {
          remoteText[key] = letter
        }
      })
      return remoteText.join('')
    },
    findSuggests () {
      return new Promise((resolve, reject) => {
        if (this.findSuggestsCanceler) this.findSuggestsCanceler()
        this.findSuggestsCanceler = reject
        if (this.isSuggestionFn) {
          if (this.isNewSuggestionsNotNeeded()) return resolve()
          this.getSuggestions(this.textVal, res => {
            if (isArray(res)) {
              resolve(res)
            } else if (isPromise(res)) {
              this.isLoading = true
              res.then(results => {
                this.isLoading = false
                resolve(results)
              })
            } else {
              resolve()
            }
          })
        } else {
          resolve(this.suggestions)
        }
      })
        .then(results => {
          if (typeof results === 'undefined') return
          this.clearSimilarData()
          results.forEach(this.addRegister)
          return results
        })
        .then(this.handleAsyncSuggestion)
        .catch(() => null)
    },
    isNewSuggestionsNotNeeded () {
      return this.selectedSuggest && this.selectedSuggest[this.suggestionAttribute] === this.textVal
    },
    setPlaceholderVal () {
      const suggest = this.getSuggest()
      if (suggest) this.placeholderVal = this.letterProcess(suggest[this.suggestionAttribute])
    },
    setTextVal () {
      const suggest = this.getSuggest()
      this.textVal = suggest[this.suggestionAttribute]
    },
    getSuggest () {
      return this.similiarData[this.highlightedIndex]
    },
    arrowDownValidation () {
      return this.highlightedIndex < (this.similiarData.length - 1)
    },
    lowerFirst (string) {
      return string.charAt(0).toLowerCase() + string.slice(1)
    },
    controlEvents () {
      var uncaptz = this.lowerFirst(this.selectedEvent + 'Action')
      var fnName = (this[uncaptz])
      if (this.fnExists(fnName)) {
        fnName()
      }
    },
    findRepited (similarItem, o) {
      return (similarItem[this.suggestionAttribute] === o[this.suggestionAttribute])
    },
    findSuggestionTextIsRepited (o) {
      return this.similiarData.find(this.findRepited.bind(this, o))
    },
    finalTextValueValidation () {
      return typeof this.similiarData[this.highlightedIndex] !== 'undefined' ||
          this.placeholderVal === '' && this.highlightedIndex !== 0
    },
    isSimilar (o) {
      if (this.findSimilar === false) {
        return true
      }
      if (o) {
        if (this.suggestOnAllWords) {
          var isMatch = false
          var words = o[this.suggestionAttribute].split(' ')
          var textValWords = this.textVal.split(' ')
          if (words.length > 0) {
            words.forEach(function (word) {
              if (textValWords.length > 0) {
                textValWords.forEach(function (textValWord) {
                  if (word.toLowerCase().startsWith(textValWord.toLowerCase())) {
                    isMatch = true
                  }
                })
              } else if (word.toLowerCase().startsWith(this.textVal.toLowerCase())) {
                isMatch = true
              }
            })
            return isMatch
          }
        }
        return o[this.suggestionAttribute]
          .toLowerCase()
          .startsWith(this.textVal.toLowerCase())
      }
    },
    isSameType (o) {
      return o.name === this.type
    },
    fnExists (fnName) {
      return typeof fnName === 'function'
    },
    canAddToSimilarData () {
      if (this.maxLimit) return this.similiarData.length < this.maxLimit
      return true
    },
    notArrowKeysEvent () {
      return !this.arrowKeysEvents.includes(this.selectedEvent)
    },
    notEnterKeyEvent () {
      return this.selectedEvent !== 'Enter'
    },
    textValIsEmpty () {
      return this.textVal === ''
    },
    textValIsNotEmpty () {
      return this.textVal !== ''
    },
    reset () {
      this.clearValue()
      this.clearSelected()
      this.clearPlaceholder()
      this.clearSimilarData()
      this.clearSelectedSuggest()
      this.emitClear()
      this.select()
    },
    clearAll () {
      this.clearSelected()
      this.clearPlaceholder()
      this.clearSimilarData()
      this.clearSelectedSuggest()
    },
    clearValue () {
      this.textVal = ''
    },
    clearSelected () {
      this.selected = null
    },
    clearSelectedSuggest () {
      this.selectedSuggest = null
    },
    clearSimilarData () {
      this.similiarData = []
    },
    clearPlaceholder () {
      if (this.textValIsEmpty()) {
        this.clearSimilarData()
        this.setInitialPlaceholder()
      } else {
        this.placeholderVal = ''
      }
    },
    clearHighlightedIndex () {
      this.highlightedIndex = 0
    },
    changeText (e) {
      this.selectedEventRaw = e.key
      this.setTextValue(e)
      this.processChangeText(e)
      this.controlEvents(e)
    },
    processChangeText (e) {
      if (this.notEnterKeyEvent()) {
        if (this.selectOnExact && this.onExact()) return
        this.emitChange()
        this.inputChanged = true
        this.suggestionsIsVisible = true
        this.clearAllAndFindSuggest()
      }
    },
    clearAllAndFindSuggest () {
      if (this.notArrowKeysEvent()) {
        this.clearAll()
        this.findSuggests()
      }
    },
    away () {
      this.suggestionsIsVisible = false
      // this.select()
    },
    inputClick (e) {
      this.suggestionsIsVisible = true
      this.emitClickInput(e)
    },
    select () {
      this.emitSelected()
      this.emitChange()
    },
    emitChange (value = this.textVal) {
      this.$emit('input', value)
    },
    emitClickInput (event) {
      this.$emit('click-input', event)
    },
    emitClickButton (event) {
      this.$emit('click-button', this.textVal)
    },
    emitEnter () {
      this.$emit('enter')
    },
    emitKeyUp () {
      this.$emit('key-up')
    },
    emitKeyDown (value = this.selectedSuggest) {
      this.$emit('key-down', value)
    },
    emitKeyRight () {
      this.$emit('key-right')
    },
    emitClear () {
      this.$emit('clear')
    },
    emitEscape () {
      this.$emit('escape')
    },
    emitSelected (value = this.selectedSuggest) {
      this.$emit('selected', value)
    }
  }
}

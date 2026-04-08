from allauth.account.adapter import DefaultAccountAdapter
import random



class CustomAllauthAccountAdapter(DefaultAccountAdapter):
    def generate_login_code(self):
        ALLOWED_CHARACTERS = 'ACDEFHJKMNPQRTUVWXY3479'
        generated_code = random.choices(ALLOWED_CHARACTERS, k=16)
        return ''.join(generated_code)




